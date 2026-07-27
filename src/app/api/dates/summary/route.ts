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

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Tarihler modülü için özet/rapor istatistikleri: yaklaşan/süresi geçen
 * deadline sayıları, türe/üniversiteye/kişiye göre dağılım, önümüzdeki 6
 * ayın aylık yaklaşan-tarih trendi. Duyurular'ın özet paneliyle aynı desen
 * — tek farkla, Tarihler "bugün ne girildi" değil "önümüzde ne var" sorusuna
 * odaklanır, bu yüzden trend günlük değil aylık bazda.
 *
 * NOT: groupBy orderBy'da `_count: { _all: ... }` YERİNE gerçek alan adı
 * kullanılır (ör. `_count: { universityId: 'desc' }`) — `_all` gerçek
 * üretilen Prisma client'ta orderBy için geçerli bir alan değil (bkz. Duyurular
 * özet endpoint'inde daha önce yaşanan build hatası).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const today = startOfDayUtc(new Date());
    const in7 = new Date(today);
    in7.setUTCDate(in7.getUTCDate() + 7);
    const in30 = new Date(today);
    in30.setUTCDate(in30.getUTCDate() + 30);
    const monthsAhead = new Date(today);
    monthsAhead.setUTCMonth(monthsAhead.getUTCMonth() + 6);

    const [
      upcoming7Count,
      upcoming30Count,
      overdueCount,
      pendingEndDateCount,
      monthlyAnnouncements,
      byUniversityRaw,
      byUserRaw,
      byTypeRaw,
    ] = await Promise.all([
      prisma.importantDate.count({ where: { date: { gte: today, lt: in7 } } }),
      prisma.importantDate.count({ where: { date: { gte: today, lt: in30 } } }),
      prisma.importantDate.count({ where: { date: { lt: today } } }),
      prisma.importantDate.count({ where: { date: null } }),
      prisma.importantDate.findMany({
        where: { date: { gte: today, lt: monthsAhead } },
        select: { date: true },
      }),
      prisma.importantDate.groupBy({
        by: ["universityId"],
        _count: { _all: true },
        orderBy: { _count: { universityId: "desc" } },
        take: 10,
      }),
      prisma.importantDate.groupBy({
        by: ["createdById"],
        _count: { _all: true },
        orderBy: { _count: { createdById: "desc" } },
      }),
      prisma.importantDate.groupBy({
        by: ["typeId"],
        _count: { _all: true },
        orderBy: { _count: { typeId: "desc" } },
      }),
    ]);

    // Önümüzdeki 6 ayın her biri 0 ile başlatılır, sonra gerçek sayımlarla doldurulur.
    const byMonthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today);
      d.setUTCMonth(d.getUTCMonth() + i);
      byMonthMap.set(monthKey(d), 0);
    }
    for (const a of monthlyAnnouncements) {
      // `date` şemada nullable olsa da bu sorgu `date: { gte, lt }` filtresi
      // uyguladığı için burada her zaman doludur (SQL NULL karşılaştırmaları
      // hiçbir zaman true dönmez, dolayısıyla null satırlar zaten elenmiştir).
      if (!a.date) continue;
      const key = monthKey(a.date);
      if (byMonthMap.has(key)) byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + 1);
    }
    const byMonth = Array.from(byMonthMap.entries()).map(([month, count]) => ({ month, count }));

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

    const universityGroups = byUniversityRaw as UniversityGroup[];
    const userGroups = byUserRaw as UserGroup[];
    const typeGroups = byTypeRaw as TypeGroup[];

    const universityIds = universityGroups.map((r) => r.universityId);
    const universities: { id: string; name: string }[] = await prisma.university.findMany({
      where: { id: { in: universityIds } },
      select: { id: true, name: true },
    });
    const universityNameById = new Map(universities.map((u) => [u.id, u.name]));
    const byUniversity = universityGroups.map((r) => ({
      universityId: r.universityId,
      name: universityNameById.get(r.universityId) ?? "Bilinmeyen",
      count: r._count._all,
    }));

    const userIds = userGroups.map((r) => r.createdById);
    const users: { id: string; name: string | null; email: string }[] = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    const byUser = userGroups.map((r) => {
      const u = userById.get(r.createdById);
      return {
        userId: r.createdById,
        name: u?.name || u?.email || "Bilinmeyen",
        count: r._count._all,
      };
    });

    const typeIds = typeGroups.map((r) => r.typeId);
    const types: { id: string; name: string }[] = await prisma.importantDateType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });
    const typeNameById = new Map(types.map((t) => [t.id, t.name]));
    const byType = typeGroups.map((r) => ({
      typeId: r.typeId,
      name: typeNameById.get(r.typeId) ?? "Bilinmeyen",
      count: r._count._all,
    }));

    return NextResponse.json({
      upcoming7Count,
      upcoming30Count,
      overdueCount,
      pendingEndDateCount,
      byMonth,
      byUniversity,
      byUser,
      byType,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
