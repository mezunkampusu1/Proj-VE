import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { toDateOrUndefined } from "@/lib/dates";
import { computeDurations } from "@/lib/daily-flow";

/** GET: Kullanıcının kendi geçmiş Günlük Akış kayıtları (takvim/liste görünümü için). */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const entries = await prisma.dailyFlowEntry.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: from ? toDateOrUndefined(from) : undefined,
          lte: to ? toDateOrUndefined(to) : undefined,
        },
      },
      include: { breaks: { orderBy: { startedAt: "asc" } } },
      orderBy: { date: "desc" },
      take: 90,
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
