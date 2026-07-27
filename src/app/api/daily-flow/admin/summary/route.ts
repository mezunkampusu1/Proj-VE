import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { toDateOrUndefined } from "@/lib/dates";
import {
  todayDateOnly,
  computeDurations,
  getTeamDefaultSetting,
  resolveEffectiveSetting,
  getOpenBreakOverageMinutes,
  findOpenPastEntries,
  closeStaleDailyFlowEntries,
  type DailyFlowEntryWithBreaks,
} from "@/lib/daily-flow";

/**
 * GET: Yönetici Dashboard'u — üst özet kartları + seçilen güne ait canlı
 * ekip listesi tek çağrıda döner (bkz. proje kuralı §8). `date` query
 * parametresi verilmezse bugün gösterilir; verilirse yönetici o günün
 * kayıtlarını görüntüler/düzenler (bkz. görev #167 — tarih bazlı takip).
 * "Eksik/hatalı kayıt" uyarısı her zaman gerçek bugüne göre hesaplanır —
 * hangi gün görüntüleniyor olursa olsun, açık kalmış geçmiş kayıtlar bu
 * uyarıda değişmeden görünür.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const viewedDate = dateParam ? (toDateOrUndefined(dateParam) ?? todayDateOnly()) : todayDateOnly();

    const members = await prisma.teamMember.findMany({
      where: { teamId: workspace.id },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { user: { name: "asc" } },
    });
    const userIds = members.map((m) => m.user.id);

    // Dashboard açılır açılmaz, dün/öncesinde açık unutulmuş kayıtlar önce
    // otomatik olarak gün sonunda kapatılır — bu sayede hem "Açık kalan
    // geçmiş kayıtlar" uyarısı güncel kalır hem de kullanıcı artık bunu
    // elle düzeltmek zorunda kalmaz (bkz. closeStaleDailyFlowEntries).
    await closeStaleDailyFlowEntries(workspace.id, userIds);

    const [todayEntries, openPastEntries, settings, teamDefaultSetting] = await Promise.all([
      prisma.dailyFlowEntry.findMany({
        where: { userId: { in: userIds }, date: viewedDate },
        include: { breaks: { orderBy: { startedAt: "asc" } } },
      }),
      findOpenPastEntries(userIds),
      prisma.dailyFlowUserSetting.findMany({ where: { userId: { in: userIds } } }),
      // Kişiye özel ayarı olmayan üyeler için takım varsayılanı (bkz. görev #169).
      getTeamDefaultSetting(workspace.id),
    ]);

    const settingByUser = new Map(settings.map((s) => [s.userId, s]));
    const entryByUser = new Map(todayEntries.map((e) => [e.userId, e]));

    let startedCount = 0;
    let activeCount = 0;
    let onBreakCount = 0;
    let completedCount = 0;
    let notStartedCount = 0;

    const team = members.map((m) => {
      const entry = entryByUser.get(m.user.id) as DailyFlowEntryWithBreaks | undefined;
      if (!entry) {
        notStartedCount++;
        return {
          user: m.user,
          entryId: null as string | null,
          status: "NOT_STARTED" as const,
          startedAt: null,
          completedAt: null,
          note: null as string | null,
          activeSeconds: 0,
          breakSeconds: 0,
          lastAction: null,
          warning: null as string | null,
        };
      }

      startedCount++;
      if (entry.status === "ACTIVE") activeCount++;
      if (entry.status === "ON_BREAK") onBreakCount++;
      if (entry.status === "COMPLETED") completedCount++;

      const durations = computeDurations(entry);
      const setting = resolveEffectiveSetting(settingByUser.get(m.user.id) ?? null, teamDefaultSetting);

      let lastAction: string | null = null;
      const lastBreak = entry.breaks[entry.breaks.length - 1];
      if (entry.status === "COMPLETED") lastAction = "Günü tamamladı";
      else if (lastBreak && !lastBreak.endedAt) lastAction = "Ara verdi";
      else if (lastBreak?.endedAt) lastAction = "Akışa döndü";
      else lastAction = "Akışı başlattı";

      let warning: string | null = null;
      if (entry.status === "ON_BREAK") {
        const overage = getOpenBreakOverageMinutes(setting, durations.openBreakSeconds);
        if (overage > 0) {
          warning = `Mevcut arası tanımlanan süreyi ${overage} dakika aştı.`;
        }
      }

      return {
        user: m.user,
        entryId: entry.id,
        status: entry.status,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        note: entry.note,
        activeSeconds: durations.activeSeconds,
        breakSeconds: durations.breakSeconds,
        lastAction,
        warning,
      };
    });

    const missingCount = openPastEntries.length;

    return NextResponse.json({
      summary: {
        startedCount,
        activeCount,
        onBreakCount,
        completedCount,
        notStartedCount,
        missingCount,
      },
      team,
      openPastEntries: openPastEntries.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name ?? e.user.email,
        date: e.date,
        status: e.status,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
