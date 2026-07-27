import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { toDateOrUndefined } from "@/lib/dates";
import { computeDurations } from "@/lib/daily-flow";

/**
 * GET: Günlük/haftalık/aylık/kullanıcı/ekip bazlı filtrelenebilir kayıt
 * listesi — yönetici raporları ve ajanda ekranı bu uç noktayı paylaşır.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const teamUserIds = (
      await prisma.teamMember.findMany({ where: { teamId: workspace.id }, select: { userId: true } })
    ).map((m) => m.userId);

    const entries = await prisma.dailyFlowEntry.findMany({
      where: {
        userId: userId ? userId : { in: teamUserIds },
        date: {
          gte: from ? toDateOrUndefined(from) : undefined,
          lte: to ? toDateOrUndefined(to) : undefined,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        breaks: { orderBy: { startedAt: "asc" } },
        edits: { orderBy: { createdAt: "desc" }, include: { editedBy: { select: { id: true, name: true, email: true } } } },
        reopenedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: "desc" }, { user: { name: "asc" } }],
      take: 500,
    });

    const withDurations = entries.map((entry) => ({
      entry,
      durations: computeDurations(entry),
    }));

    return NextResponse.json({ entries: withDurations });
  } catch (error) {
    return handleApiError(error);
  }
}
