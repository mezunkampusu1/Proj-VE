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

/**
 * Duyurular modülü için özet/rapor istatistikleri: bugün/bu hafta girilen
 * sayısı, üniversiteye göre dağılım, son N günün trendi, kişiye göre
 * dağılım. "Bu bir raporlama sistemi" geri bildirimi üzerine eklendi —
 * ekip liderinin "kim, ne zaman, hangi üniversiteden ne kadar girdi"
 * sorusunu tek ekranda cevaplaması için.
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

    const [todayCount, weekCount, rangeAnnouncements, byUniversityRaw, byUserRaw, byTypeRaw] =
      await Promise.all([
        prisma.announcement.count({ where: { entryDate: today } }),
        prisma.announcement.count({ where: { entryDate: { gte: weekStart } } }),
        prisma.announcement.findMany({
          where: { entryDate: { gte: rangeStart } },
          select: { entryDate: true },
        }),
        prisma.announcement.groupBy({
          by: ["universityId"],
          where: { entryDate: { gte: rangeStart } },
          _count: { _all: true },
          orderBy: { _count: { universityId: "desc" } },
          take: 10,
        }),
        prisma.announcement.groupBy({
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
      ]);

    // Boş günler de grafikte görünsün diye 0 ile başlatılmış bir harita
    // kurulur, sonra gerçek sayımlarla doldurulur.
    const byDateMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart);
      d.setUTCDate(d.getUTCDate() + i);
      byDateMap.set(toDateKey(d), 0);
    }
    for (const a of rangeAnnouncements) {
      const key = toDateKey(a.entryDate);
      byDateMap.set(key, (byDateMap.get(key) ?? 0) + 1);
    }
    const byDate = Array.from(byDateMap.entries()).map(([date, count]) => ({ date, count }));

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
    const announcementTypes: { id: string; name: string }[] = await prisma.announcementType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });
    const typeNameById = new Map(announcementTypes.map((t) => [t.id, t.name]));
    const byType = typeGroups.map((r) => ({
      typeId: r.typeId,
      name: typeNameById.get(r.typeId) ?? "Bilinmeyen",
      count: r._count._all,
    }));

    return NextResponse.json({ todayCount, weekCount, byDate, byUniversity, byUser, byType });
  } catch (error) {
    return handleApiError(error);
  }
}
