import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { formatTime } from "@/lib/utils";
import {
  getTodayEntry,
  getUserSetting,
  getTeamDefaultSetting,
  resolveEffectiveSetting,
  computeDurations,
  getBreakAllowance,
  getScheduleTags,
  buildTimeline,
  todayDateOnly,
  notifyAdminsForDailyFlowEvent,
  closeStaleDailyFlowEntries,
} from "@/lib/daily-flow";

/**
 * GET: Kullanıcının bugüne ait Günlük Akış durumunu, hesaplanan süreleri,
 * kalan ara hakkını ve zaman çizelgesini döner. Kayıt yoksa `status:
 * "NOT_STARTED"` ile boş bir gövde döner (henüz akış başlatılmamış).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    // Dün (veya önceki bir gün) açık unutulmuş bir kayıt varsa, "bugün"
    // gösterilmeden önce otomatik olarak gün sonunda kapatılır (bkz.
    // closeStaleDailyFlowEntries — kullanıcı talebi: "o gün bitince
    // otomatikmen son bulsun").
    await closeStaleDailyFlowEntries(workspace.id, [session.user.id]);

    const entry = await getTodayEntry(session.user.id);
    // Kişiye özel ayar > takım varsayılanı > sınırsız (bkz. görev #169).
    const [userSetting, teamSetting] = await Promise.all([
      getUserSetting(session.user.id),
      getTeamDefaultSetting(workspace.id),
    ]);
    const setting = resolveEffectiveSetting(userSetting, teamSetting);

    if (!entry) {
      return NextResponse.json({
        status: "NOT_STARTED",
        entry: null,
        durations: null,
        breakAllowance: getBreakAllowance(setting, 0, 0),
        scheduleTags: [],
        timeline: [],
        // İstemci saatiyle sunucu saati arasında fark olabilir (bkz. görev
        // #166 — akış başladıktan sonra "Aktif süre" saymaya başlamıyordu,
        // sebebi cihaz saatinin sunucudan ileri/geri olmasıydı). İstemci bu
        // alanı kendi Date.now()'uyla kıyaslayıp bir ofset çıkarır ve canlı
        // sayaçta ham Date.now() yerine bu ofsetle düzeltilmiş zamanı kullanır.
        serverNow: new Date().toISOString(),
      });
    }

    const durations = computeDurations(entry);
    const breakAllowance = getBreakAllowance(setting, entry.breaks.length, durations.breakSeconds);
    const scheduleTags = getScheduleTags(setting, entry);
    const timeline = buildTimeline(entry);

    return NextResponse.json({
      status: entry.status,
      entry,
      durations,
      breakAllowance,
      scheduleTags,
      timeline,
      // bkz. görev #166 — client/server saat farkı düzeltmesi için.
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: "Akışı Başlat" — bugün için henüz kayıt yoksa oluşturur. Saat her
 * zaman sunucu tarafında (`new Date()`) alınır, istemciden saat kabul
 * edilmez (bkz. proje kuralı: "Kullanıcının cihaz saatine güvenilmemeli").
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.dailyFlowEntry.findUnique({
      where: { userId_date: { userId: session.user.id, date: todayDateOnly() } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bugün için akış zaten başlatılmış." },
        { status: 409 },
      );
    }

    const startedAt = new Date();
    const entry = await prisma.dailyFlowEntry.create({
      data: {
        userId: session.user.id,
        date: todayDateOnly(),
        status: "ACTIVE",
        startedAt,
      },
      include: { breaks: true },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_STARTED",
      module: "DAILY_FLOW",
      message: "Günlük akışını başlattı.",
      ipAddress: getClientIp(req),
    });

    const displayName = session.user.name || session.user.email || "Bir kullanıcı";
    await notifyAdminsForDailyFlowEvent({
      teamId: workspace.id,
      excludeUserId: session.user.id,
      eventKey: "onStart",
      title: "Günlük akış başladı",
      message: `${displayName}, günlük akışını ${formatTime(startedAt)}'te başlattı.`,
      link: "/daily-flow",
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
