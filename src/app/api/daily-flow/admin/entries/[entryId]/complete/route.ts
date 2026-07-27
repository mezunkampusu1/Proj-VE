import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { computeDurations } from "@/lib/daily-flow";

/** POST: Yönetici, kullanıcı adına günü tamamlar. */
export async function POST(req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { entryId } = await params;
    const entry = await prisma.dailyFlowEntry.findUnique({
      where: { id: entryId },
      include: { breaks: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!entry) throw new NotFoundError("Günlük Akış kaydı bulunamadı.");
    if (entry.status === "COMPLETED") {
      return NextResponse.json({ error: "Bu gün zaten tamamlanmış." }, { status: 409 });
    }

    const completedAt = new Date();
    const durations = computeDurations({ ...entry, status: "ACTIVE" }, completedAt);

    const updated = await prisma.dailyFlowEntry.update({
      where: { id: entryId },
      data: {
        status: "COMPLETED",
        completedAt,
        totalActiveSeconds: durations.activeSeconds,
        totalBreakSeconds: durations.breakSeconds,
        breakCount: durations.closedBreakCount,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_COMPLETED",
      module: "DAILY_FLOW",
      message: `${entry.user.name || entry.user.email} kullanıcısı adına günü tamamladı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
