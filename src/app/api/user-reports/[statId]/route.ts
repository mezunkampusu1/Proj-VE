import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDailyStatSchema } from "@/lib/validations";
import { requireTeamMember, requireTeamAdmin, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ statId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { statId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.dailyUserStat.findUnique({ where: { id: statId } });
    if (!existing) throw new NotFoundError("Kayıt bulunamadı.");
    if (existing.recordedById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu kaydı yalnızca giren kişi veya yönetici düzenleyebilir.");
    }

    const body = await req.json();
    const data = updateDailyStatSchema.parse(body);

    const stat = await prisma.dailyUserStat.update({
      where: { id: statId },
      data,
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_STAT_RECORDED",
      module: "USER_REPORTS",
      message: `${stat.date.toISOString().slice(0, 10)} tarihli kullanıcı raporu güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ stat });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { statId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // Kayıt silme, yanlışlıkla veri kaybını önlemek için yöneticiyle sınırlıdır.
    await requireTeamAdmin(workspace.id, session.user.id);

    const existing = await prisma.dailyUserStat.findUnique({ where: { id: statId } });
    if (!existing) throw new NotFoundError("Kayıt bulunamadı.");

    await prisma.dailyUserStat.delete({ where: { id: statId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_STAT_RECORDED",
      module: "USER_REPORTS",
      message: `${existing.date.toISOString().slice(0, 10)} tarihli kullanıcı raporu silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
