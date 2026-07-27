import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { formatTime } from "@/lib/utils";
import { getTodayEntry, notifyAdminsForDailyFlowEvent } from "@/lib/daily-flow";

/**
 * POST: "Ara Ver" — yalnızca kayıt ACTIVE durumundayken çağrılabilir. Bu
 * kontrol aynı zamanda "aynı anda iki açık ara" senaryosunu da doğal olarak
 * engeller: bir ara açıkken durum zaten ON_BREAK'tir.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const entry = await getTodayEntry(session.user.id);
    if (!entry) {
      return NextResponse.json({ error: "Bugün için henüz akış başlatılmadı." }, { status: 409 });
    }
    if (entry.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Ara vermek için akışın aktif olması gerekir." },
        { status: 409 },
      );
    }

    const startedAt = new Date();
    await prisma.$transaction([
      prisma.dailyFlowBreak.create({ data: { entryId: entry.id, startedAt } }),
      prisma.dailyFlowEntry.update({ where: { id: entry.id }, data: { status: "ON_BREAK" } }),
    ]);

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_BREAK_STARTED",
      module: "DAILY_FLOW",
      message: "Ara verdi.",
      ipAddress: getClientIp(req),
    });

    const displayName = session.user.name || session.user.email || "Bir kullanıcı";
    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onBreakStart",
      title: "Ara verildi",
      message: `${displayName}, ${formatTime(startedAt)}'te ara verdi.`,
      link: "/daily-flow",
    });

    return NextResponse.json({ message: "Ara kaydın oluşturuldu." });
  } catch (error) {
    return handleApiError(error);
  }
}
