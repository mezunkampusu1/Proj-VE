import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/activity";
import type {
  DailyFlowEntry,
  DailyFlowBreak,
  DailyFlowUserSetting,
  DailyFlowTeamSetting,
  DailyFlowNotificationPreference,
} from "@prisma/client";

/**
 * Modül 7 — Günlük Akış. Klasik "mesai/personel takip" değil: üyenin kendi
 * gününü başlatıp/ara verip/tamamladığı, sunucu saatine dayalı bir akış
 * kaydı. Bu dosya, tüm modüllerde saf/tekrar kullanılabilir hesaplama
 * mantığını barındırır — API route'ları veri erişimi + yetki + bildirim
 * katmanını üstlenir (bkz. src/app/api/daily-flow/**).
 *
 * NOT_STARTED ayrı bir DB değeri değildir: bugün için hiç DailyFlowEntry
 * satırı yoksa kullanıcı "henüz başlamadı" sayılır (bkz. getTodayEntry).
 */

/** Sunucunun yerel takvim gününü, saat bileşeni olmadan `Date` olarak döner. */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Bir `Date`i (saat bileşeni ne olursa olsun) o günün gece yarısına indirger. */
export function toDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export type DailyFlowEntryWithBreaks = DailyFlowEntry & { breaks: DailyFlowBreak[] };

/** Kullanıcının bugüne ait akış kaydını (varsa) aralarıyla birlikte döner. */
export async function getTodayEntry(userId: string): Promise<DailyFlowEntryWithBreaks | null> {
  return prisma.dailyFlowEntry.findUnique({
    where: { userId_date: { userId, date: todayDateOnly() } },
    include: { breaks: { orderBy: { startedAt: "asc" } } },
  });
}

/** Kullanıcı için tanımlanmış ara hakkı/çalışma düzeni ayarı — yoksa null (sınırsız kabul edilir). */
export async function getUserSetting(userId: string): Promise<DailyFlowUserSetting | null> {
  return prisma.dailyFlowUserSetting.findUnique({ where: { userId } });
}

/** Takımın varsayılan ara hakkı/çalışma düzeni — yoksa null (bkz. görev #169). */
export async function getTeamDefaultSetting(teamId: string): Promise<DailyFlowTeamSetting | null> {
  return prisma.dailyFlowTeamSetting.findUnique({ where: { teamId } });
}

/**
 * DailyFlowUserSetting ve DailyFlowTeamSetting'in paylaştığı ara hakkı/
 * çalışma düzeni alanları — hesaplama fonksiyonları (getBreakAllowance,
 * getScheduleTags, getOpenBreakOverageMinutes) yalnızca bu alanlara
 * bakar, hangi kaynaktan geldiği önemli değildir (bkz. görev #169).
 */
export interface DailyFlowBreakRule {
  maxBreakCount: number | null;
  maxBreakMinutes: number | null;
  maxTotalBreakMinutes: number | null;
  standardStartMinute: number | null;
  standardEndMinute: number | null;
}

/**
 * Çözümleme sırası: kişiye özel ayar > takım varsayılanı > sınırsız (bkz.
 * proje talebi görev #169 — "kişiye özgü tanımladığım gibi genele de
 * yapmam gerekiyor"). Kişiye özel bir satır varsa TÜMÜYLE onun alanları
 * kullanılır — alan bazında karışık bir birleştirme yapılmaz, aksi halde
 * bir yöneticinin bir kullanıcı için bilinçli olarak "sınırsız" bıraktığı
 * bir alan, takım varsayılanı tarafından sessizce ezilebilir.
 */
export function resolveEffectiveSetting(
  userSetting: DailyFlowUserSetting | null,
  teamSetting: DailyFlowTeamSetting | null,
): DailyFlowBreakRule | null {
  return userSetting ?? teamSetting ?? null;
}

export interface DurationBreakdown {
  /** Şu ana kadar geçen aktif çalışma süresi (saniye) — açık bir ara varsa o süre hariçtir. */
  activeSeconds: number;
  /** Şu ana kadar kullanılan toplam ara süresi (saniye) — açık ara da dahil, "şu an" itibarıyla. */
  breakSeconds: number;
  /** Şu anda açık (devam eden) bir ara varsa onun süresi (saniye), yoksa 0. */
  openBreakSeconds: number;
  /** Kapanmış ara sayısı (açık ara sayılmaz). */
  closedBreakCount: number;
}

/**
 * Bir akış kaydının o ana kadarki (veya tamamlanmışsa completedAt'e kadarki)
 * aktif/ara sürelerini hesaplar. Kayıt COMPLETED ise ve önceden hesaplanmış
 * `totalActiveSeconds`/`totalBreakSeconds` doluysa onlar kullanılır (raporlama
 * tutarlılığı için — sonradan `now` değiştikçe kaymasın).
 */
export function computeDurations(
  entry: DailyFlowEntryWithBreaks,
  now: Date = new Date(),
): DurationBreakdown {
  if (entry.status === "COMPLETED" && entry.totalActiveSeconds != null) {
    return {
      activeSeconds: entry.totalActiveSeconds,
      breakSeconds: entry.totalBreakSeconds ?? 0,
      openBreakSeconds: 0,
      closedBreakCount: entry.breakCount ?? entry.breaks.length,
    };
  }

  const endMoment = entry.completedAt ?? now;
  const totalElapsedSeconds = Math.max(
    0,
    Math.floor((endMoment.getTime() - entry.startedAt.getTime()) / 1000),
  );

  let breakSeconds = 0;
  let openBreakSeconds = 0;
  let closedBreakCount = 0;

  for (const b of entry.breaks) {
    if (b.endedAt) {
      breakSeconds += Math.max(0, Math.floor((b.endedAt.getTime() - b.startedAt.getTime()) / 1000));
      closedBreakCount += 1;
    } else {
      openBreakSeconds = Math.max(0, Math.floor((endMoment.getTime() - b.startedAt.getTime()) / 1000));
      breakSeconds += openBreakSeconds;
    }
  }

  const activeSeconds = Math.max(0, totalElapsedSeconds - breakSeconds);

  return { activeSeconds, breakSeconds, openBreakSeconds, closedBreakCount };
}

export interface BreakAllowance {
  /** Ara hakkı hiç tanımlanmamışsa true — sınırsız kabul edilir. */
  unlimited: boolean;
  maxBreakCount: number | null;
  maxBreakMinutes: number | null;
  maxTotalBreakMinutes: number | null;
  usedCount: number;
  usedMinutes: number;
  /** Kullanıcıya gösterilecek sade, tek satırlık özet metin. */
  summaryText: string;
}

/** Kalan ara hakkını, kullanıcıya gösterilecek sade bir metinle birlikte hesaplar. */
export function getBreakAllowance(
  setting: DailyFlowBreakRule | null,
  usedCount: number,
  usedSeconds: number,
): BreakAllowance {
  const usedMinutes = Math.round(usedSeconds / 60);

  if (!setting || (setting.maxBreakCount == null && setting.maxTotalBreakMinutes == null)) {
    return {
      unlimited: true,
      maxBreakCount: setting?.maxBreakCount ?? null,
      maxBreakMinutes: setting?.maxBreakMinutes ?? null,
      maxTotalBreakMinutes: setting?.maxTotalBreakMinutes ?? null,
      usedCount,
      usedMinutes,
      summaryText: usedMinutes > 0 ? `Bugün ${usedMinutes} dakika ara kullandın.` : "Ara hakkın sınırsız.",
    };
  }

  const parts: string[] = [];
  if (setting.maxBreakCount != null) {
    const remaining = Math.max(0, setting.maxBreakCount - usedCount);
    parts.push(`${remaining} ara hakkın kaldı`);
  }
  if (setting.maxTotalBreakMinutes != null) {
    const remaining = Math.max(0, setting.maxTotalBreakMinutes - usedMinutes);
    parts.push(`${remaining} dakika ara süren kaldı`);
  }

  return {
    unlimited: false,
    maxBreakCount: setting.maxBreakCount,
    maxBreakMinutes: setting.maxBreakMinutes,
    maxTotalBreakMinutes: setting.maxTotalBreakMinutes,
    usedCount,
    usedMinutes,
    summaryText: parts.length > 0 ? `Bugün ${parts.join(", ")}.` : `Bugün ${usedMinutes} dakika ara kullandın.`,
  };
}

/**
 * Şu anda açık bir ara, tanımlanan tekil-ara süresini aşmış mı? Sistem
 * kullanıcıyı otomatik döndürmez — yalnızca yönetici paneli için bilgi
 * üretir (bkz. proje kuralı §3).
 */
export function getOpenBreakOverageMinutes(
  setting: DailyFlowBreakRule | null,
  openBreakSeconds: number,
): number {
  if (!setting?.maxBreakMinutes) return 0;
  const overageSeconds = openBreakSeconds - setting.maxBreakMinutes * 60;
  return overageSeconds > 0 ? Math.round(overageSeconds / 60) : 0;
}

export interface ScheduleTag {
  kind: "LATE_START" | "EARLY_FINISH" | "OVER_DURATION";
  label: string;
}

/**
 * Yönetici standart çalışma saati tanımlamışsa, kaydı hiçbir şekilde
 * engellemeden yalnızca bilgilendirici etiket üretir — cezalandırıcı dil
 * kullanılmaz (bkz. proje kuralı §17).
 */
export function getScheduleTags(
  setting: DailyFlowBreakRule | null,
  entry: DailyFlowEntry,
): ScheduleTag[] {
  const tags: ScheduleTag[] = [];
  if (!setting) return tags;

  const startMinuteOfDay = entry.startedAt.getHours() * 60 + entry.startedAt.getMinutes();
  if (setting.standardStartMinute != null && startMinuteOfDay > setting.standardStartMinute) {
    tags.push({ kind: "LATE_START", label: "Planlanan saatten geç başladı" });
  }

  if (entry.completedAt) {
    const endMinuteOfDay = entry.completedAt.getHours() * 60 + entry.completedAt.getMinutes();
    if (setting.standardEndMinute != null && endMinuteOfDay < setting.standardEndMinute) {
      tags.push({ kind: "EARLY_FINISH", label: "Planlanan saatten erken tamamladı" });
    }
    if (
      setting.standardStartMinute != null &&
      setting.standardEndMinute != null &&
      entry.totalActiveSeconds != null
    ) {
      const plannedSeconds = (setting.standardEndMinute - setting.standardStartMinute) * 60;
      if (plannedSeconds > 0 && entry.totalActiveSeconds > plannedSeconds) {
        tags.push({ kind: "OVER_DURATION", label: "Planlanan sürenin üzerinde çalıştı" });
      }
    }
  }

  return tags;
}

export type TimelineEventKind =
  | "STARTED"
  | "BREAK_STARTED"
  | "BREAK_ENDED"
  | "COMPLETED";

export interface TimelineEvent {
  kind: TimelineEventKind;
  at: Date;
}

/** Kullanıcının günlük özet ekranındaki zaman çizelgesi için sıralı olay listesi. */
export function buildTimeline(entry: DailyFlowEntryWithBreaks): TimelineEvent[] {
  const events: TimelineEvent[] = [{ kind: "STARTED", at: entry.startedAt }];
  for (const b of entry.breaks) {
    events.push({ kind: "BREAK_STARTED", at: b.startedAt });
    if (b.endedAt) events.push({ kind: "BREAK_ENDED", at: b.endedAt });
  }
  if (entry.completedAt) events.push({ kind: "COMPLETED", at: entry.completedAt });
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Ekip görünümünde gösterilen sade durum — süre/detay içermez. */
export type TeamMemberStatus = "ACTIVE" | "ON_BREAK" | "NOT_STARTED" | "COMPLETED";

export function deriveTeamStatus(entry: DailyFlowEntry | null): TeamMemberStatus {
  if (!entry) return "NOT_STARTED";
  return entry.status;
}

/**
 * Geçmişte açık kalmış (tamamlanmamış, bugünden önceki) kayıtları bulur —
 * gerçek bir gece cron'u yerine sorgu anında hesaplanır (bkz. proje kararı:
 * ayrı bir zamanlanmış görev altyapısı eklenmedi). Yönetici panelini her
 * açtığında güncel sonucu görür.
 */
type NotifyEventKey = keyof Omit<DailyFlowNotificationPreference, "id" | "userId" | "updatedAt">;

const DEFAULT_NOTIFICATION_PREF: Record<NotifyEventKey, boolean> = {
  onStart: true,
  onBreakStart: false,
  onBreakResume: false,
  onComplete: true,
  onBreakExceeded: true,
  onDayLeftOpen: true,
  onRecordEdited: false,
};

/**
 * Ekipteki yöneticilere, kendi bildirim tercihlerine (bkz.
 * DailyFlowNotificationPreference) göre Günlük Akış olayı bildirimi yollar.
 * Tercih tanımlanmamış yöneticiler için alan bazlı varsayılanlar geçerlidir.
 */
export async function notifyAdminsForDailyFlowEvent(input: {
  teamId: string;
  excludeUserId?: string;
  eventKey: NotifyEventKey;
  title: string;
  message: string;
  link?: string;
}) {
  const admins = await prisma.teamMember.findMany({
    where: {
      teamId: input.teamId,
      role: "ADMIN",
      ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  if (admins.length === 0) return;

  const prefs = await prisma.dailyFlowNotificationPreference.findMany({
    where: { userId: { in: admins.map((a) => a.userId) } },
  });
  const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

  for (const admin of admins) {
    const pref = prefByUser.get(admin.userId) ?? DEFAULT_NOTIFICATION_PREF;
    if (!pref[input.eventKey]) continue;
    await notifyUser({
      userId: admin.userId,
      type: "DAILY_FLOW_EVENT",
      title: input.title,
      message: input.message,
      link: input.link,
    });
  }
}

export async function findOpenPastEntries(teamMemberUserIds: string[]) {
  return prisma.dailyFlowEntry.findMany({
    where: {
      userId: { in: teamMemberUserIds },
      status: { in: ["ACTIVE", "ON_BREAK"] },
      date: { lt: todayDateOnly() },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "asc" },
  });
}

/**
 * Geçmişte açık kalmış (bugünden önceki, ACTIVE/ON_BREAK durumunda unutulmuş)
 * kayıtları bulup o günün gece yarısında (23:59:59.999) otomatik tamamlanmış
 * sayar — kullanıcı talebi: "dün akışı tamamlamayı unuttu, halen aktif
 * görünüyor, o gün bitince otomatikmen son bulsun 00:00'da". Gerçek bir gece
 * cron'u yerine, findOpenPastEntries'in izlediği aynı proje kararıyla, ilgili
 * okuma uç noktaları (bkz. /api/daily-flow, /api/daily-flow/team,
 * /api/daily-flow/admin/summary) her çağrıldığında bu fonksiyonu önce
 * çalıştırır — böylece hangi ekran önce açılırsa açılsın sonuç güncel kalır.
 * Açık bir ara varsa o da aynı an'da (gün sonunda) kapatılır ve süre
 * hesaplarına dahil edilir. Yöneticilere `onDayLeftOpen` tercihine göre
 * bilgilendirme bildirimi gönderilir (önceden hiç tetiklenmiyordu).
 */
export async function closeStaleDailyFlowEntries(teamId: string, teamMemberUserIds: string[]) {
  if (teamMemberUserIds.length === 0) return [];

  const staleEntries = await prisma.dailyFlowEntry.findMany({
    where: {
      userId: { in: teamMemberUserIds },
      status: { in: ["ACTIVE", "ON_BREAK"] },
      date: { lt: todayDateOnly() },
    },
    include: {
      breaks: { orderBy: { startedAt: "asc" } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: "asc" },
  });

  for (const entry of staleEntries) {
    const endOfDay = new Date(
      entry.date.getFullYear(),
      entry.date.getMonth(),
      entry.date.getDate(),
      23,
      59,
      59,
      999,
    );
    const durations = computeDurations(entry, endOfDay);
    const hadOpenBreak = entry.breaks.some((b) => !b.endedAt);

    await prisma.$transaction([
      ...entry.breaks
        .filter((b) => !b.endedAt)
        .map((b) =>
          prisma.dailyFlowBreak.update({ where: { id: b.id }, data: { endedAt: endOfDay } }),
        ),
      prisma.dailyFlowEntry.update({
        where: { id: entry.id },
        data: {
          status: "COMPLETED",
          completedAt: endOfDay,
          totalActiveSeconds: durations.activeSeconds,
          totalBreakSeconds: durations.breakSeconds,
          breakCount: durations.closedBreakCount + (hadOpenBreak ? 1 : 0),
        },
      }),
    ]);

    await notifyAdminsForDailyFlowEvent({
      teamId,
      eventKey: "onDayLeftOpen",
      title: "Gün otomatik tamamlandı",
      message: `${entry.user.name ?? entry.user.email}, ${entry.date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihli günlük akışını tamamlamayı unuttu — gün sonunda otomatik olarak tamamlandı.`,
      link: "/daily-flow/admin",
    });
  }

  return staleEntries;
}
