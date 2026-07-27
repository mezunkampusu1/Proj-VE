import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import {
  resolveFinancePermissions,
  assertPermission,
  financeVisibilityWhere,
  canViewTransaction,
} from "@/lib/finance-permissions";
import type { Prisma } from "@prisma/client";

type RangeType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

function dayStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Seçilen aralık tipine göre {start, end} hesaplar (bkz. proje talebi §9 — günlük/haftalık/aylık/yıllık/özel). */
function resolveRange(type: RangeType, from: string | null, to: string | null): { start: Date; end: Date } {
  const now = new Date();
  const today = dayStart(now);

  if (type === "custom" && from && to) {
    return {
      start: new Date(`${from}T00:00:00.000Z`),
      end: new Date(`${to}T23:59:59.999Z`),
    };
  }

  if (type === "daily") {
    const end = new Date(today);
    end.setUTCHours(23, 59, 59, 999);
    return { start: today, end };
  }

  if (type === "weekly") {
    const dow = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (dow - 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  if (type === "yearly") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    return { start, end };
  }

  // monthly (default)
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Karşılaştırma için bir önceki eşit uzunluktaki dönemi hesaplar. */
function previousRange(start: Date, end: Date): { start: Date; end: Date } {
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { start: prevStart, end: prevEnd };
}

function bucketKey(date: Date, granularity: "day" | "week" | "month") {
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const d = dayStart(date);
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow - 1));
    return d.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function chooseGranularity(start: Date, end: Date): "day" | "week" | "month" {
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 45) return "day";
  if (days <= 210) return "week";
  return "month";
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Havalesi",
  AUTOMATIC_PAYMENT: "Otomatik Ödeme",
  OTHER: "Diğer",
};

/**
 * Finans raporları uç noktası (bkz. proje talebi §9). Tablo ve grafik
 * değerlerinin BİREBİR eşleşmesi için tüm kırılımlar (zaman serisi,
 * kategori/kişi/firma/para-birimi/ödeme-yöntemi bazlı) TEK BİR bellekteki
 * işlem listesinden hesaplanır — ayrı ayrı groupBy sorgularının arasında
 * tutarsızlık oluşma riski böylece ortadan kalkar.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canViewFinance, "Finans sayfasını görüntüleme yetkiniz yok.");
    assertPermission(permissions.canViewReports, "Finans raporlarını görüntüleme yetkiniz yok.");

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });
    const visibilityWhere = financeVisibilityWhere(
      session.user.id,
      membership.role,
      permissions,
      me?.departmentId ?? null,
    );

    const { searchParams } = new URL(req.url);
    const rangeType = (searchParams.get("range") as RangeType) ?? "monthly";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const { start, end } = resolveRange(rangeType, from, to);
    const { start: prevStart, end: prevEnd } = previousRange(start, end);
    const granularity = chooseGranularity(start, end);

    const baseWhere: Prisma.FinanceTransactionWhereInput = {
      deletedAt: null,
      status: { not: "CANCELLED" },
      AND: [visibilityWhere],
      transactionDate: { gte: start, lte: end },
    };

    const [transactions, prevTransactions, recurringTemplates, pendingPayments] = await Promise.all([
      prisma.financeTransaction.findMany({
        where: baseWhere,
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          category: { select: { id: true, name: true, type: true } },
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.financeTransaction.findMany({
        where: {
          deletedAt: null,
          status: { not: "CANCELLED" },
          AND: [visibilityWhere],
          transactionDate: { gte: prevStart, lte: prevEnd },
        },
        select: { type: true, amountTry: true },
      }),
      prisma.financeRecurringTemplate.findMany({
        where: { active: true },
        include: {
          currency: { select: { code: true, symbol: true } },
          category: { select: { name: true } },
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { nextOccurrenceDate: "asc" },
      }),
      prisma.financeTransaction.findMany({
        where: { deletedAt: null, status: { in: ["PENDING", "PARTIALLY_PAID"] }, AND: [visibilityWhere] },
        include: {
          currency: { select: { code: true, symbol: true } },
          category: { select: { name: true } },
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    const visibleRecurringTemplates = recurringTemplates.filter((t) =>
      canViewTransaction(
        { createdById: t.createdById, personId: t.personId, visibility: t.visibility, departmentId: t.departmentId },
        session.user.id,
        membership.role,
        permissions,
        me?.departmentId ?? null,
      ),
    );

    // ---- Toplamlar ----
    let incomeTry = 0;
    let expenseTry = 0;
    const timeSeriesMap = new Map<string, { incomeTry: number; expenseTry: number }>();
    const categoryMap = new Map<string, { categoryId: string; name: string; type: string; totalTry: number; count: number }>();
    const personMap = new Map<string, { personId: string; name: string; totalTry: number; count: number }>();
    const payeeMap = new Map<string, { payeeName: string; totalTry: number; count: number }>();
    const currencyMap = new Map<
      string,
      { currencyId: string; code: string; symbol: string; totalTry: number; count: number }
    >();
    const paymentMethodMap = new Map<string, { method: string; label: string; totalTry: number; count: number }>();

    for (const t of transactions) {
      const amountTry = Number(t.amountTry);
      if (t.type === "INCOME") incomeTry += amountTry;
      else expenseTry += amountTry;

      const key = bucketKey(t.transactionDate, granularity);
      const bucket = timeSeriesMap.get(key) ?? { incomeTry: 0, expenseTry: 0 };
      if (t.type === "INCOME") bucket.incomeTry += amountTry;
      else bucket.expenseTry += amountTry;
      timeSeriesMap.set(key, bucket);

      const cat = categoryMap.get(t.categoryId) ?? {
        categoryId: t.categoryId,
        name: t.category.name,
        type: t.category.type,
        totalTry: 0,
        count: 0,
      };
      cat.totalTry += amountTry;
      cat.count += 1;
      categoryMap.set(t.categoryId, cat);

      if (t.type === "EXPENSE") {
        const p = personMap.get(t.personId) ?? {
          personId: t.personId,
          name: t.person.name || t.person.email,
          totalTry: 0,
          count: 0,
        };
        p.totalTry += amountTry;
        p.count += 1;
        personMap.set(t.personId, p);
      }

      if (t.payeeName) {
        const pe = payeeMap.get(t.payeeName) ?? { payeeName: t.payeeName, totalTry: 0, count: 0 };
        pe.totalTry += amountTry;
        pe.count += 1;
        payeeMap.set(t.payeeName, pe);
      }

      const cur = currencyMap.get(t.currencyId) ?? {
        currencyId: t.currencyId,
        code: t.currency.code,
        symbol: t.currency.symbol,
        totalTry: 0,
        count: 0,
      };
      cur.totalTry += amountTry;
      cur.count += 1;
      currencyMap.set(t.currencyId, cur);

      if (t.paymentMethod) {
        const pm = paymentMethodMap.get(t.paymentMethod) ?? {
          method: t.paymentMethod,
          label: paymentMethodLabels[t.paymentMethod] ?? t.paymentMethod,
          totalTry: 0,
          count: 0,
        };
        pm.totalTry += amountTry;
        pm.count += 1;
        paymentMethodMap.set(t.paymentMethod, pm);
      }
    }

    const timeSeries = Array.from(timeSeriesMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([bucket, v]) => ({ bucket, incomeTry: Math.round(v.incomeTry * 100) / 100, expenseTry: Math.round(v.expenseTry * 100) / 100 }));

    const byCategory = Array.from(categoryMap.values())
      .map((c) => ({ ...c, totalTry: Math.round(c.totalTry * 100) / 100 }))
      .sort((a, b) => b.totalTry - a.totalTry);

    const byPerson = Array.from(personMap.values())
      .map((p) => ({ ...p, totalTry: Math.round(p.totalTry * 100) / 100 }))
      .sort((a, b) => b.totalTry - a.totalTry);

    const byPayee = Array.from(payeeMap.values())
      .map((p) => ({ ...p, totalTry: Math.round(p.totalTry * 100) / 100 }))
      .sort((a, b) => b.totalTry - a.totalTry)
      .slice(0, 15);

    const byCurrency = Array.from(currencyMap.values())
      .map((c) => ({ ...c, totalTry: Math.round(c.totalTry * 100) / 100 }))
      .sort((a, b) => b.totalTry - a.totalTry);

    const byPaymentMethod = Array.from(paymentMethodMap.values())
      .map((p) => ({ ...p, totalTry: Math.round(p.totalTry * 100) / 100 }))
      .sort((a, b) => b.totalTry - a.totalTry);

    const topExpenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .slice()
      .sort((a, b) => Number(b.amountTry) - Number(a.amountTry))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        transactionDate: t.transactionDate,
        amount: t.amount,
        amountTry: t.amountTry,
        currency: t.currency,
        category: t.category,
        person: t.person,
        payeeName: t.payeeName,
      }));

    // ---- Önceki dönem karşılaştırması ----
    let prevIncomeTry = 0;
    let prevExpenseTry = 0;
    for (const t of prevTransactions) {
      if (t.type === "INCOME") prevIncomeTry += Number(t.amountTry);
      else prevExpenseTry += Number(t.amountTry);
    }
    const netTry = incomeTry - expenseTry;
    const prevNetTry = prevIncomeTry - prevExpenseTry;
    function pctChange(curr: number, prev: number) {
      if (prev === 0) return curr === 0 ? 0 : null;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    return NextResponse.json({
      range: { type: rangeType, start, end, granularity },
      totals: {
        incomeTry: Math.round(incomeTry * 100) / 100,
        expenseTry: Math.round(expenseTry * 100) / 100,
        netTry: Math.round(netTry * 100) / 100,
        recordCount: transactions.length,
      },
      timeSeries,
      byCategory,
      byPerson,
      byPayee,
      byCurrency,
      byPaymentMethod,
      topExpenses,
      pendingPayments,
      recurringExpenses: visibleRecurringTemplates,
      periodComparison: {
        current: { incomeTry: Math.round(incomeTry * 100) / 100, expenseTry: Math.round(expenseTry * 100) / 100, netTry: Math.round(netTry * 100) / 100 },
        previous: {
          incomeTry: Math.round(prevIncomeTry * 100) / 100,
          expenseTry: Math.round(prevExpenseTry * 100) / 100,
          netTry: Math.round(prevNetTry * 100) / 100,
        },
        changePct: {
          income: pctChange(incomeTry, prevIncomeTry),
          expense: pctChange(expenseTry, prevExpenseTry),
          net: pctChange(netTry, prevNetTry),
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
