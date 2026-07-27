import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { formatTime } from "@/lib/utils";
import { getTodayEntry, notifyAdminsForDailyFlowEvent } from "@/lib/daily-flow";

/** POST: "Akışa Dön" — açık arayı kapatır, durumu tekrar ACTIVE yapar. */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const entry = await getTodayEntry(session.user.id);
    if (!entry || entry.status !== "ON_BREAK") {
      return NextResponse.json({ error: "Şu anda açık bir aran yok." }, { status: 409 });
    }

    const openBreak = entry.breaks.find((b) => !b.endedAt);
    if (!openBreak) {
      return NextResponse.json({ error: "Açık ara kaydı bulunamadı." }, { status: 409 });
    }

    const endedAt = new Date();
    await prisma.$transaction([
      prisma.dailyFlowBreak.update({ where: { id: openBreak.id }, data: { endedAt } }),
      prisma.dailyFlowEntry.update({ where: { id: entry.id }, data: { status: "ACTIVE" } }),
    ]);

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_BREAK_ENDED",
      module: "DAILY_FLOW",
      message: "Akışa döndü.",
      ipAddress: getClientIp(req),
    });

    const displayName = session.user.name || session.user.email || "Bir kullanıcı";
    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onBreakResume",
      title: "Akışa dönüldü",
      message: `${displayName}, ${formatTime(endedAt)}'te akışa döndü.`,
      link: "/daily-flow",
    });

    return NextResponse.json({ message: "Tekrar hoş geldin. Akışın devam ediyor." });
  } catch (error) {
    return handleApiError(error);
  }
}
