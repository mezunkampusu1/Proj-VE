import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFinanceCurrencySchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveFinancePermissions, assertPermission } from "@/lib/finance-permissions";
import { getCurrentRate } from "@/lib/finance";

/**
 * Para birimleri — TRY/USD/EUR/gram altınla başlar, "gerekirse sonradan
 * yeni para birimi eklenebilecek yapı" (bkz. proje talebi §2) için admin
 * yenilerini ekleyebilir. Her para biriminin güncel kuru da beraber döner.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const currencies = await prisma.financeCurrency.findMany({
      where: { isActive: true },
      orderBy: [{ isBase: "desc" }, { code: "asc" }],
    });

    const withRates = await Promise.all(
      currencies.map(async (c) => ({
        ...c,
        currentRate: await getCurrentRate(c.id, c.isBase),
      })),
    );

    return NextResponse.json({ currencies: withRates });
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
    assertPermission(permissions.canManageRates, "Para birimi/kur yönetme yetkiniz yok.");

    const body = await req.json();
    const data = createFinanceCurrencySchema.parse(body);
    const code = data.code.trim().toUpperCase();

    const existing = await prisma.financeCurrency.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Bu kodla bir para birimi zaten kayıtlı." }, { status: 409 });
    }

    const currency = await prisma.financeCurrency.create({
      data: {
        code,
        name: data.name.trim(),
        symbol: data.symbol.trim(),
        decimalPlaces: data.decimalPlaces ?? 2,
      },
    });

    return NextResponse.json({ currency }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
