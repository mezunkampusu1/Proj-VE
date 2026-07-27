import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { dailyFlowUserSettingSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";

/**
 * GET: Takım genelindeki varsayılan ara hakkı/çalışma düzeni — yoksa null
 * (sınırsız). Kişiye özel bir DailyFlowUserSetting satırı OLMAYAN üyeler
 * için geçerli olur (bkz. görev #169 — "kişiye özgü tanımladığım gibi
 * genele de yapmam gerekiyor").
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const setting = await prisma.dailyFlowTeamSetting.findUnique({ where: { teamId: workspace.id } });
    return NextResponse.json({ setting });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT: Takım varsayılanını tanımlar/günceller — alan anlamları kişiye özel ayarla birebir aynıdır. */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = dailyFlowUserSettingSchema.parse(body);

    const setting = await prisma.dailyFlowTeamSetting.upsert({
      where: { teamId: workspace.id },
      create: { teamId: workspace.id, ...data, updatedById: session.user.id },
      update: { ...data, updatedById: session.user.id },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_SETTING_UPDATED",
      module: "DAILY_FLOW",
      message: "Takımın varsayılan Günlük Akış ayarlarını güncelledi.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return handleApiError(error);
  }
}
