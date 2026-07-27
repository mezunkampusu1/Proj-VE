import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFinanceCurrencySchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveFinancePermissions, assertPermission } from "@/lib/finance-permissions";

interface Params {
  params: Promise<{ currencyId: string }>;
}

/** Para birimi düzenleme/pasife alma — TL (temel para birimi) pasife alınamaz. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { currencyId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canManageRates, "Para birimi yönetme yetkiniz yok.");

    const existing = await prisma.financeCurrency.findUnique({ where: { id: currencyId } });
    if (!existing) throw new NotFoundError("Para birimi bulunamadı.");

    const body = await req.json();
    const data = updateFinanceCurrencySchema.parse(body);

    if (existing.isBase && data.isActive === false) {
      return NextResponse.json({ error: "Temel para birimi (TL) pasife alınamaz." }, { status: 400 });
    }

    const currency = await prisma.financeCurrency.update({
      where: { id: currencyId },
      data: {
        isActive: data.isActive,
        name: data.name?.trim(),
        symbol: data.symbol?.trim(),
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RATE_UPDATED",
      module: "FINANCE",
      message: `"${currency.code}" para birimi güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ currency });
  } catch (error) {
    return handleApiError(error);
  }
}
