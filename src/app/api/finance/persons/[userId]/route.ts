import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveFinancePermissions, assertPermission, financeVisibilityWhere } from "@/lib/finance-permissions";
import type { Prisma } from "@prisma/client";

interface Params {
  params: Promise<{ userId: string }>;
}

/**
 * Kişi bazlı harcama detay sayfası verisi (bkz. proje talebi §4). Yalnızca
 * gider (EXPENSE) kayıtları hesaba katılır — "harcama takibi" kişinin ne
 * harcadığını gösterir, geliri değil. Görünürlük kuralları burada da aynen
 * uygulanır: bir başkasının sayfasını açan kullanıcı yalnızca kendisine
 * görünür kayıtları görür.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { userId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canViewFinance, "Finans sayfasını görüntüleme yetkiniz yok.");

    const person = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!person) throw new NotFoundError("Kullanıcı bulunamadı.");

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });
    const visibilityWhere = financeVisibilityWhere(
      session.user.id,
      membership.role,
      permissions,
      me?.departmentId ?? null,
    );

    const baseWhere: Prisma.FinanceTransactionWhereInput = {
      deletedAt: null,
      status: { not: "CANCELLED" },
      type: "EXPENSE",
      personId: userId,
      AND: [visibilityWhere],
    };

    const now = new Date();
    const todayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() === 0 ? 6 : weekStart.getUTCDay() - 1));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const [
      allTime,
      daily,
      weekly,
      monthly,
      yearly,
      topCategoryGroups,
      byPayeeGroups,
      pendingPayments,
      recordCount,
      attachments,
    ] = await Promise.all([
      prisma.financeTransaction.aggregate({ where: baseWhere, _sum: { amountTry: true } }),
      prisma.financeTransaction.aggregate({
        where: { ...baseWhere, transactionDate: { gte: todayStart } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { ...baseWhere, transactionDate: { gte: weekStart } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { ...baseWhere, transactionDate: { gte: monthStart } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { ...baseWhere, transactionDate: { gte: yearStart } },
        _sum: { amountTry: true },
      }),
      prisma.financeTransaction.groupBy({
        by: ["categoryId"],
        where: baseWhere,
        _sum: { amountTry: true },
        orderBy: { _sum: { amountTry: "desc" } },
        take: 1,
      }),
      prisma.financeTransaction.groupBy({
        by: ["payeeName"],
        where: { ...baseWhere, payeeName: { not: null } },
        _sum: { amountTry: true },
        orderBy: { _sum: { amountTry: "desc" } },
        take: 5,
      }),
      prisma.financeTransaction.findMany({
        where: { ...baseWhere, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        include: { currency: { select: { code: true } }, category: { select: { name: true } } },
        orderBy: { transactionDate: "asc" },
        take: 20,
      }),
      prisma.financeTransaction.count({ where: baseWhere }),
      prisma.financeAttachment.findMany({
        where: { uploadedById: userId, transaction: { deletedAt: null, AND: [visibilityWhere] } },
        include: { transaction: { select: { id: true, category: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    let topCategory: { id: string; name: string; totalTry: number } | null = null;
    if (topCategoryGroups[0]) {
      const category = await prisma.financeCategory.findUnique({
        where: { id: topCategoryGroups[0].categoryId },
        select: { id: true, name: true },
      });
      if (category) topCategory = { ...category, totalTry: Number(topCategoryGroups[0]._sum.amountTry ?? 0) };
    }

    const byPayee = byPayeeGroups.map((g) => ({
      payeeName: g.payeeName ?? "Belirtilmedi",
      totalTry: Number(g._sum.amountTry ?? 0),
    }));

    const allTimeTry = Number(allTime._sum.amountTry ?? 0);

    return NextResponse.json({
      person,
      totals: {
        allTimeTry,
        dailyTry: Number(daily._sum.amountTry ?? 0),
        weeklyTry: Number(weekly._sum.amountTry ?? 0),
        monthlyTry: Number(monthly._sum.amountTry ?? 0),
        yearlyTry: Number(yearly._sum.amountTry ?? 0),
      },
      topCategory,
      byPayee,
      pendingPayments,
      recordCount,
      averageAmountTry: recordCount > 0 ? Math.round((allTimeTry / recordCount) * 100) / 100 : 0,
      attachments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
