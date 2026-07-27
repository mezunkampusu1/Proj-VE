import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { dailyFlowUserSettingSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ userId: string }>;
}

/** GET: Kullanıcı için tanımlanmış ara hakkı/çalışma düzeni — yoksa null (sınırsız). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { userId } = await params;
    const setting = await prisma.dailyFlowUserSetting.findUnique({ where: { userId } });
    return NextResponse.json({ setting });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT: Ara hakkı + standart çalışma saatlerini tanımlar/günceller. Her alan
 * bağımsız olarak boş bırakılabilir — "yalnızca adet sınırı", "yalnızca
 * toplam süre sınırı", "tamamen serbest" gibi kombinasyonları destekler
 * (bkz. proje kuralı §3).
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { userId } = await params;
    const body = await req.json();
    const data = dailyFlowUserSettingSchema.parse(body);

    const setting = await prisma.dailyFlowUserSetting.upsert({
      where: { userId },
      create: { userId, ...data, updatedById: session.user.id },
      update: { ...data, updatedById: session.user.id },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_SETTING_UPDATED",
      module: "DAILY_FLOW",
      message: "Bir kullanıcının Günlük Akış ayarlarını güncelledi.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return handleApiError(error);
  }
}
