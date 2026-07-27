import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { completeDailyFlowSchema } from "@/lib/validations";
import { formatTime, formatDurationHM, formatDurationMinutes } from "@/lib/utils";
import { getTodayEntry, computeDurations, notifyAdminsForDailyFlowEvent } from "@/lib/daily-flow";

/**
 * POST: "Günü Tamamla" — yalnızca akış ACTIVE iken çağrılabilir (arada iken
 * önce akışa dönülmesi gerekir, bkz. proje kuralı §2). Süreler bu anda
 * kalıcı olarak hesaplanıp saklanır; gün tamamlandıktan sonra aynı gün
 * yeniden akış başlatılamaz — yalnızca yönetici yeniden açabilir.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json().catch(() => ({}));
    const data = completeDailyFlowSchema.parse(body);

    const entry = await getTodayEntry(session.user.id);
    if (!entry) {
      return NextResponse.json({ error: "Bugün için henüz akış başlatılmadı." }, { status: 409 });
    }
    if (entry.status === "COMPLETED") {
      return NextResponse.json({ error: "Bugünün akışı zaten tamamlanmış." }, { status: 409 });
    }
    if (entry.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Günü tamamlamadan önce akışa dönmen gerekiyor." },
        { status: 409 },
      );
    }

    const completedAt = new Date();
    const durations = computeDurations({ ...entry, completedAt }, completedAt);

    const updated = await prisma.dailyFlowEntry.update({
      where: { id: entry.id },
      data: {
        status: "COMPLETED",
        completedAt,
        note: data.note ?? undefined,
        totalActiveSeconds: durations.activeSeconds,
        totalBreakSeconds: durations.breakSeconds,
        breakCount: durations.closedBreakCount,
      },
      include: { breaks: true },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_COMPLETED",
      module: "DAILY_FLOW",
      message: `Günlük akışını ${formatTime(completedAt)}'te tamamladı.`,
      ipAddress: getClientIp(req),
    });

    const displayName = session.user.name || session.user.email || "Bir kullanıcı";
    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onComplete",
      title: "Günlük akış tamamlandı",
      message:
        `${displayName}, günlük akışını ${formatTime(completedAt)}'te tamamladı. ` +
        `Başlangıç: ${formatTime(entry.startedAt)}, bitiş: ${formatTime(completedAt)}, ` +
        `toplam aktif süre: ${formatDurationHM(durations.activeSeconds)}, ` +
        `ara sayısı: ${durations.closedBreakCount}, toplam ara süresi: ${formatDurationMinutes(durations.breakSeconds)}.`,
      link: "/daily-flow",
    });

    return NextResponse.json({ entry: updated, message: "Bugünün akışını tamamladın. Eline sağlık." });
  } catch (error) {
    return handleApiError(error);
  }
}
