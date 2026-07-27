import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordDailyStatSchema } from "@/lib/validations";
import { requireTeamMember, getTeamMembership } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

function parseDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 1), 365);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const stats = await prisma.dailyUserStat.findMany({
      where: { date: { gte: since } },
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ stats });
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

    const body = await req.json();
    const data = recordDailyStatSchema.parse(body);
    const date = parseDateOnly(data.date);

    const existing = await prisma.dailyUserStat.findUnique({ where: { date } });
    if (existing && existing.recordedById !== session.user.id && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bu günün kaydını yalnızca giren kişi veya yönetici düzenleyebilir." },
        { status: 403 },
      );
    }

    const stat = await prisma.dailyUserStat.upsert({
      where: { date },
      create: {
        date,
        newUserCount: data.newUserCount,
        emailVerifiedCount: data.emailVerifiedCount,
        phoneVerifiedCount: data.phoneVerifiedCount,
        note: data.note ?? null,
        recordedById: session.user.id,
      },
      update: {
        newUserCount: data.newUserCount,
        emailVerifiedCount: data.emailVerifiedCount,
        phoneVerifiedCount: data.phoneVerifiedCount,
        note: data.note ?? null,
        recordedById: session.user.id,
      },
      include: { recordedBy: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_STAT_RECORDED",
      module: "USER_REPORTS",
      message: `${data.date} tarihi için kullanıcı raporu ${existing ? "güncellendi" : "girildi"}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ stat }, { status: existing ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
