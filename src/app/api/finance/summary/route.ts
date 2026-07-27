import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveFinancePermissions, assertPermission, financeVisibilityWhere } from "@/lib/finance-permissions";
import { generateDueFinanceTransactions, notifyDuePayments } from "@/lib/finance";
import type { Prisma } from "@prisma/client";

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { start, end };
}

/**
 * Finans ana sayfa özet verisi (bkz. proje talebi §1). Farklı para birimleri
 * ASLA doğrudan toplanmaz — para birimi bazında ayrı toplamlar döner;
 * ayrıca sade bir "TL karşılığı" toplamı da (amountTry üzerinden) sunulur.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canViewFinance, "Finans sayfasını görüntüleme yetkiniz yok.");

    await generateDueFinanceTransactions();
    await notifyDuePayments();

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });
    const visibilityWhere = financeVisibilityWhere(
      session.user.id,
      membership.role,
      permissions,
      me?.departmentId ?? null,
    );

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const rangeWhere: Prisma.FinanceTransactionWhereInput =
      from || to
        ? {
            transactionDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {};

    const baseWhere: Prisma.FinanceTransactionWhereInput = {
      deletedAt: null,
      status: { not: "CANCELLED" },
      AND: [visibilityWhere],
      ...rangeWhere,
    };

    const { start: thisMonthStart, end: thisMonthEnd } = monthRange(0);
    const { start: lastMonthStart, end: lastMonthEnd } = monthRange(-1);
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const in30Days = new Date(today);
    in30Days.setUTCDate(in30Days.getUTCDate() + 30);

    const [
      byCurrencyGrouped,
      thisMonthExpense,
      lastMonthExpense,
      topSpenderGroups,
      topCategoryGroups,
      pendingCount,
      upcoming,
      overdue,
    ] = await Promise.all([
      prisma.financeTransaction.groupBy({
        by: ["type", "currencyId"],
        where: baseWhere,
        _sum: { amount: true, amountTry: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { deletedAt: null, status: { not: "CANCELLED" }, type: "EXPENSE", AND: [visibilityWhere], transactionDate: { gte: thisMonthStart, lt: thisMonthEnd } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { deletedAt: null, status: { not: "CANCELLED" }, type: "EXPENSE", AND: [visibilityWhere], transactionDate: { gte: lastMonthStart, lt: lastMonthEnd } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.groupBy({
        by: ["personId"],
        where: { ...baseWhere, type: "EXPENSE" },
        _sum: { amountTry: true },
        orderBy: { _sum: { amountTry: "desc" } },
        take: 1,
      }),
      prisma.financeTransaction.groupBy({
        by: ["categoryId"],
        where: { ...baseWhere, type: "EXPENSE" },
        _sum: { amountTry: true },
        orderBy: { _sum: { amountTry: "desc" } },
        take: 1,
      }),
      prisma.financeTransaction.count({
        where: { deletedAt: null, status: { in: ["PENDING", "PARTIALLY_PAID"] }, AND: [visibilityWhere] },
      }),
      prisma.financeTransaction.findMany({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          AND: [visibilityWhere],
          transactionDate: { gte: today, lte: in30Days },
        },
        include: {
          currency: { select: { code: true, symbol: true } },
          category: { select: { name: true } },
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { transactionDate: "asc" },
        take: 10,
      }),
      prisma.financeTransaction.findMany({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          AND: [visibilityWhere],
          transactionDate: { lt: today },
        },
        include: {
          currency: { select: { code: true, symbol: true } },
          category: { select: { name: true } },
          person: { select: { id: true, name: true, email: true } },
        },
        orderBy: { transactionDate: "asc" },
        take: 10,
      }),
    ]);

    const currencies = await prisma.financeCurrency.findMany({
      where: { id: { in: byCurrencyGrouped.map((g) => g.currencyId) } },
      select: { id: true, code: true, symbol: true },
    });
    const currencyMap = new Map(currencies.map((c) => [c.id, c]));

    const expenseByCurrency = byCurrencyGrouped
      .filter((g) => g.type === "EXPENSE")
      .map((g) => ({
        currencyId: g.currencyId,
        code: currencyMap.get(g.currencyId)?.code ?? "?",
        symbol: currencyMap.get(g.currencyId)?.symbol ?? "",
        total: Number(g._sum.amount ?? 0),
      }));
    const incomeByCurrency = byCurrencyGrouped
      .filter((g) => g.type === "INCOME")
      .map((g) => ({
        currencyId: g.currencyId,
        code: currencyMap.get(g.currencyId)?.code ?? "?",
        symbol: currencyMap.get(g.currencyId)?.symbol ?? "",
        total: Number(g._sum.amount ?? 0),
      }));

    const totalExpenseTry = byCurrencyGrouped
      .filter((g) => g.type === "EXPENSE")
      .reduce((sum, g) => sum + Number(g._sum.amountTry ?? 0), 0);
    const totalIncomeTry = byCurrencyGrouped
      .filter((g) => g.type === "INCOME")
      .reduce((sum, g) => sum + Number(g._sum.amountTry ?? 0), 0);

    const thisMonthExpenseTry = Number(thisMonthExpense._sum.amountTry ?? 0);
    const lastMonthExpenseTry = Number(lastMonthExpense._sum.amountTry ?? 0);
    const monthOverMonthChangePct =
      lastMonthExpenseTry > 0
        ? Math.round(((thisMonthExpenseTry - lastMonthExpenseTry) / lastMonthExpenseTry) * 1000) / 10
        : null;

    let topSpender: { id: string; name: string | null; email: string; totalTry: number } | null = null;
    if (topSpenderGroups[0]) {
      const person = await prisma.user.findUnique({
        where: { id: topSpenderGroups[0].personId },
        select: { id: true, name: true, email: true },
      });
      if (person) {
        topSpender = { ...person, totalTry: Number(topSpenderGroups[0]._sum.amountTry ?? 0) };
      }
    }

    let topCategory: { id: string; name: string; totalTry: number } | null = null;
    if (topCategoryGroups[0]) {
      const category = await prisma.financeCategory.findUnique({
        where: { id: topCategoryGroups[0].categoryId },
        select: { id: true, name: true },
      });
      if (category) {
        topCategory = { ...category, totalTry: Number(topCategoryGroups[0]._sum.amountTry ?? 0) };
      }
    }

    const upcomingTotalTry = upcoming.reduce((sum, t) => sum + Number(t.amountTry), 0);

    return NextResponse.json({
      expenseByCurrency,
      incomeByCurrency,
      totalExpenseTry,
      totalIncomeTry,
      netTry: totalIncomeTry - totalExpenseTry,
      thisMonthExpenseTry,
      lastMonthExpenseTry,
      monthOverMonthChangePct,
      topSpender,
      topCategory,
      pendingCount,
      upcomingTotalTry,
      upcoming,
      overdue,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
