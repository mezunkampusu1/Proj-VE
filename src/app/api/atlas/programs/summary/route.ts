import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { degreeLevelLabel, atlasFieldLabel, formatDate } from "@/lib/utils";

function startOfDayUtc(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Atlas modülü için özet/rapor istatistikleri: bugün/bu hafta girilen
 * program sayısı, aktif/pasif toplamları, son 30 günün giriş trendi,
 * dereceye/enstitüye/kişiye göre dağılım ve son değişiklikler akışı.
 * Duyurular'ın özet paneliyle aynı desen — Atlas'a özgü ek olarak, "sürekli
 * güncelleniyor" geri bildirimi üzerine bir "Son Değişiklikler" mini akışı
 * eklendi.
 *
 * NOT: groupBy orderBy'da gerçek alan adı kullanılır (`_all` DEĞİL) — bkz.
 * Duyurular özet endpoint'inde yaşanan build hatası.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const today = startOfDayUtc(new Date());
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const rangeStart = new Date(today);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);

    const [
      todayCount,
      weekCount,
      activeCount,
      inactiveCount,
      rangePrograms,
      byInstituteRaw,
      byUserRaw,
      byDegreeRaw,
      recentChanges,
    ] = await Promise.all([
      prisma.atlasProgram.count({ where: { entryDate: today } }),
      prisma.atlasProgram.count({ where: { entryDate: { gte: weekStart } } }),
      prisma.atlasProgram.count({ where: { isActive: true } }),
      prisma.atlasProgram.count({ where: { isActive: false } }),
      prisma.atlasProgram.findMany({
        where: { entryDate: { gte: rangeStart } },
        select: { entryDate: true },
      }),
      prisma.atlasProgram.groupBy({
        by: ["instituteId"],
        where: { isActive: true },
        _count: { _all: true },
        orderBy: { _count: { instituteId: "desc" } },
      }),
      prisma.atlasProgram.groupBy({
        by: ["createdById"],
        _count: { _all: true },
        orderBy: { _count: { createdById: "desc" } },
      }),
      prisma.atlasProgram.groupBy({
        by: ["degreeLevel"],
        _count: { _all: true },
        orderBy: { _count: { degreeLevel: "desc" } },
      }),
      prisma.atlasChangeLog.findMany({
        include: {
          program: { select: { id: true, name: true } },
          changedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { changedAt: "desc" },
        take: 10,
      }),
    ]);

    const byDateMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(rangeStart);
      d.setUTCDate(d.getUTCDate() + i);
      byDateMap.set(toDateKey(d), 0);
    }
    for (const p of rangePrograms) {
      const key = toDateKey(p.entryDate);
      byDateMap.set(key, (byDateMap.get(key) ?? 0) + 1);
    }
    const byDate = Array.from(byDateMap.entries()).map(([date, count]) => ({ date, count }));

    interface GroupCount {
      _count: { _all: number };
    }
    interface InstituteGroup extends GroupCount {
      instituteId: string;
    }
    interface UserGroup extends GroupCount {
      createdById: string;
    }
    interface DegreeGroup extends GroupCount {
      degreeLevel: string;
    }

    const instituteGroups = byInstituteRaw as InstituteGroup[];
    const userGroups = byUserRaw as UserGroup[];
    const degreeGroups = byDegreeRaw as DegreeGroup[];

    // Enstitüye göre dağılım — Institute artık üniversiteden bağımsız
    // olduğundan (bkz. Institute modeli), doğrudan enstitü adına göre
    // toplanır (yalnızca gerçekten programı olan enstitüler çekilir).
    const instituteIds = instituteGroups.map((r) => r.instituteId);
    const institutes: { id: string; name: string }[] = await prisma.institute.findMany({
      where: { id: { in: instituteIds } },
      select: { id: true, name: true },
    });
    const instituteById = new Map(institutes.map((i) => [i.id, i]));

    const byInstitute = instituteGroups
      .map((r) => {
        const inst = instituteById.get(r.instituteId);
        if (!inst) return null;
        return { instituteId: r.instituteId, name: inst.name, count: r._count._all };
      })
      .filter((v): v is { instituteId: string; name: string; count: number } => v !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

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

    const byDegree = degreeGroups.map((r) => ({
      degreeLevel: r.degreeLevel,
      name: degreeLevelLabel(r.degreeLevel),
      count: r._count._all,
    }));

    const recentChangesFormatted = recentChanges.map((c) => {
      const actionLabel =
        c.action === "CREATED" ? "eklendi" : c.action === "REMOVED" ? "pasifleştirildi" : "güncellendi";
      const fieldLabel = c.field ? ` (${atlasFieldLabel(c.field)})` : "";
      return {
        id: c.id,
        programName: c.program.name,
        actorName: c.changedBy.name || c.changedBy.email,
        message: `"${c.program.name}" ${actionLabel}${fieldLabel}`,
        changedAt: c.changedAt.toISOString(),
        changedAtLabel: formatDate(c.changedAt),
      };
    });

    return NextResponse.json({
      todayCount,
      weekCount,
      activeCount,
      inactiveCount,
      byDate,
      byInstitute,
      byUser,
      byDegree,
      recentChanges: recentChangesFormatted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
