import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { todayDateOnly, closeStaleDailyFlowEntries } from "@/lib/daily-flow";

/**
 * GET: Ekip üyelerinin yalnızca anlık durumu — süre/detay/ara sayısı gibi
 * bilgiler kasıtlı olarak dönmez (bkz. proje kuralı §6: "Normal üyeler,
 * diğer kullanıcıların toplam çalışma süresi, ara süresi veya detaylı zaman
 * kayıtlarını görememeli"). Denetim hissi vermeyen sade bir liste amaçlanır.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const members = await prisma.teamMember.findMany({
      where: { teamId: workspace.id },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { user: { name: "asc" } },
    });

    // Gün açık unutulmuşsa (dün veya öncesi) ekip listesine "Aktif" olarak
    // yansımadan önce otomatik olarak gün sonunda kapatılır (bkz.
    // closeStaleDailyFlowEntries).
    await closeStaleDailyFlowEntries(workspace.id, members.map((m) => m.user.id));

    const todayEntries = await prisma.dailyFlowEntry.findMany({
      where: { userId: { in: members.map((m) => m.user.id) }, date: todayDateOnly() },
      select: { userId: true, status: true },
    });
    const statusByUser = new Map(todayEntries.map((e) => [e.userId, e.status]));

    const team = members.map((m) => ({
      user: m.user,
      status: statusByUser.get(m.user.id) ?? "NOT_STARTED",
    }));

    return NextResponse.json({ team });
  } catch (error) {
    return handleApiError(error);
  }
}
