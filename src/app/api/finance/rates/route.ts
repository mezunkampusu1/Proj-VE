import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setFinanceRateSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveFinancePermissions, assertPermission } from "@/lib/finance-permissions";

/**
 * Kur geçmişi — ekleme-yalnız (insert-only). GET son 20 kaydı döner
 * (admin kur ekranında geçmişi görebilsin diye); "güncel kur" her zaman
 * en yeni satırdır. Bir işlem oluşturulduğunda kullanılan kur ayrıca
 * FinanceTransaction.rateToTry'ye kopyalanır ve bir daha DEĞİŞMEZ (bkz.
 * proje talebi §8).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const currencyId = searchParams.get("currencyId");

    const rates = await prisma.financeExchangeRate.findMany({
      where: currencyId ? { currencyId } : undefined,
      include: {
        currency: { select: { id: true, code: true, name: true, symbol: true } },
        setBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ rates });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canManageRates, "Kur bilgisi yönetme yetkiniz yok.");

    const body = await req.json();
    const data = setFinanceRateSchema.parse(body);

    const currency = await prisma.financeCurrency.findUnique({ where: { id: data.currencyId } });
    if (!currency) throw new NotFoundError("Para birimi bulunamadı.");
    if (currency.isBase) {
      return NextResponse.json({ error: "Temel para biriminin (TL) kuru değiştirilemez." }, { status: 400 });
    }

    const rate = await prisma.financeExchangeRate.create({
      data: {
        currencyId: currency.id,
        rateToTry: data.rateToTry,
        source: "MANUAL",
        setById: session.user.id,
      },
      include: { currency: { select: { id: true, code: true, name: true, symbol: true } } },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RATE_UPDATED",
      module: "FINANCE",
      message: `${currency.code} kuru 1 ${currency.code} = ${data.rateToTry} TL olarak güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
