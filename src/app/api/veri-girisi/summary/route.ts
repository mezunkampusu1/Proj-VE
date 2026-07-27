import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

function startOfDayUtc(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

interface GroupCount {
  _count: { _all: number };
}
interface UniversityGroup extends GroupCount {
  universityId: string;
}
interface UserGroup extends GroupCount {
  createdById: string;
}
interface TypeGroup extends GroupCount {
  typeId: string;
}

/**
 * Veri Girişi modülü için birleşik özet/rapor istatistikleri — Duyurular ve
 * Tarihler'in ayrı özet endpoint'leriyle AYNI deseni izler (bkz.
 * announcements/summary, dates/summary), ama iki tabloyu (Announcement +
 * ImportantDate) tek bir "ne kadar veri girildi" bakış açısıyla birleştirir
 * (bkz. kullanıcı talebi: "kaç tane girildi, hangi gün neler girildi, hangi
 * üniversiteden ne kadar girildi, en çok hangi tür girildi"). Her iki
 * modelde de `entryDate` "bu kayıt ne zaman girildi" anlamına geldiği için
 * (deadline değil) tüm zaman bazlı kırılımlar entryDate üzerinden yapılır.
 *
 * NOT: groupBy orderBy'da `_count: { _all: ... }` YERİNE gerçek alan adı
 * kullanılır — `_all` gerçek üretilen Prisma client'ta orderBy için geçerli
 * bir alan değil (bkz. Duyurular özet endpoint'inde daha önce yaşanan build
 * hatası, aynı hataya burada da düşülmemesi için).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 7), 90);

    const today = startOfDayUtc(new Date());
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const rangeStart = new Date(today);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    const [
      totalAnnouncements,
      totalDates,
      todayAnnouncements,
      todayDates,
      weekAnnouncements,
      weekDates,
      rangeAnnouncements,
      rangeDates,
      byUniversityAnnouncementsRaw,
      byUniversityDatesRaw,
      byUserAnnouncementsRaw,
      byUserDatesRaw,
      byAnnouncementTypeRaw,
      byImportantDateTypeRaw,
    ] = await Promise.all([
      prisma.announcement.count(),
      prisma.importantDate.count(),
      prisma.announcement.count({ where: { entryDate: today } }),
      prisma.importantDate.count({ where: { entryDate: today } }),
      prisma.announcement.count({ where: { entryDate: { gte: weekStart } } }),
      prisma.importantDate.count({ where: { entryDate: { gte: weekStart } } }),
      prisma.announcement.findMany({ where: { entryDate: { gte: rangeStart } }, select: { entryDate: true } }),
      prisma.importantDate.findMany({ where: { entryDate: { gte: rangeStart } }, select: { entryDate: true } }),
      prisma.announcement.groupBy({
        by: ["universityId"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { universityId: "desc" } },
      }),
      prisma.importantDate.groupBy({
        by: ["universityId"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { universityId: "desc" } },
      }),
      prisma.announcement.groupBy({
        by: ["createdById"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { createdById: "desc" } },
      }),
      prisma.importantDate.groupBy({
        by: ["createdById"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { createdById: "desc" } },
      }),
      prisma.announcement.groupBy({
        by: ["typeId"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { typeId: "desc" } },
      }),
      prisma.importantDate.groupBy({
        by: ["typeId"],
        where: { entryDate: { gte: rangeStart } },
        _count: { _all: true },
        orderBy: { _count: { typeId: "desc" } },
      }),
    ]);

    const totalCount = totalAnnouncements + totalDates;
    const todayCount = todayAnnouncements + todayDates;
    const weekCount = weekAnnouncements + weekDates;

    // Boş günler de grafikte görünsün diye 0 ile başlatılmış bir harita
    // kurulur, sonra her iki tablonun gerçek sayımlarıyla doldurulur.
    const byDateMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart);
      d.setUTCDate(d.getUTCDate() + i);
      byDateMap.set(toDateKey(d), 0);
    }
    for (const a of [...rangeAnnouncements, ...rangeDates]) {
      const key = toDateKey(a.entryDate);
      byDateMap.set(key, (byDateMap.get(key) ?? 0) + 1);
    }
    const byDate = Array.from(byDateMap.entries()).map(([date, count]) => ({ date, count }));

    // Üniversite ve kişi kırılımları iki tablodan gelen sayımlar
    // birleştirilerek (aynı id için toplanarak) hesaplanır.
    const universityGroups = [
      ...(byUniversityAnnouncementsRaw as UniversityGroup[]),
      ...(byUniversityDatesRaw as UniversityGroup[]),
    ];
    const universityCountMap = new Map<string, number>();
    for (const g of universityGroups) {
      universityCountMap.set(g.universityId, (universityCountMap.get(g.universityId) ?? 0) + g._count._all);
    }
    const universityIds = Array.from(universityCountMap.keys());
    const universities: { id: string; name: string }[] = await prisma.university.findMany({
      where: { id: { in: universityIds } },
      select: { id: true, name: true },
    });
    const universityNameById = new Map(universities.map((u) => [u.id, u.name]));
    const byUniversity = Array.from(universityCountMap.entries())
      .map(([universityId, count]) => ({
        universityId,
        name: universityNameById.get(universityId) ?? "Bilinmeyen",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const userGroups = [...(byUserAnnouncementsRaw as UserGroup[]), ...(byUserDatesRaw as UserGroup[])];
    const userCountMap = new Map<string, number>();
    for (const g of userGroups) {
      userCountMap.set(g.createdById, (userCountMap.get(g.createdById) ?? 0) + g._count._all);
    }
    const userIds = Array.from(userCountMap.keys());
    const users: { id: string; name: string | null; email: string }[] = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    const byUser = Array.from(userCountMap.entries())
      .map(([userId, count]) => {
        const u = userById.get(userId);
        return { userId, name: u?.name || u?.email || "Bilinmeyen", count };
      })
      .sort((a, b) => b.count - a.count);

    // Tür kırılımı: Duyuru türleri (AnnouncementType) ve Tarih türleri
    // (ImportantDateType) ayrı tablolar olduğundan, isim çakışmasını önlemek
    // için her birine "Veri" / "Tarih" etiketi eklenerek tek bir sıralı
    // listede birleştirilir.
    const announcementTypeGroups = byAnnouncementTypeRaw as TypeGroup[];
    const importantDateTypeGroups = byImportantDateTypeRaw as TypeGroup[];
    const [announcementTypeRows, importantDateTypeRows]: [
      { id: string; name: string }[],
      { id: string; name: string }[],
    ] = await Promise.all([
      prisma.announcementType.findMany({
        where: { id: { in: announcementTypeGroups.map((g) => g.typeId) } },
        select: { id: true, name: true },
      }),
      prisma.importantDateType.findMany({
        where: { id: { in: importantDateTypeGroups.map((g) => g.typeId) } },
        select: { id: true, name: true },
      }),
    ]);
    const announcementTypeNameById = new Map(announcementTypeRows.map((t) => [t.id, t.name]));
    const importantDateTypeNameById = new Map(importantDateTypeRows.map((t) => [t.id, t.name]));
    const byType = [
      ...announcementTypeGroups.map((g) => ({
        typeId: g.typeId,
        kind: "ANNOUNCEMENT" as const,
        name: announcementTypeNameById.get(g.typeId) ?? "Bilinmeyen",
        count: g._count._all,
      })),
      ...importantDateTypeGroups.map((g) => ({
        typeId: g.typeId,
        kind: "DATE" as const,
        name: importantDateTypeNameById.get(g.typeId) ?? "Bilinmeyen",
        count: g._count._all,
      })),
    ].sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalCount,
      todayCount,
      weekCount,
      byDate,
      byUniversity,
      byUser,
      byType,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
