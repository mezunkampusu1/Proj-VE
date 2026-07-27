import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";

/**
 * Raporlama/Performans uç noktası (bkz. proje talebi §9/§16). Finans
 * raporlarındaki AYNI yaklaşım: tüm kırılımlar tek bir bellek taramasından
 * hesaplanır. Görünürlük filtresi burada UYGULANMAZ — `canViewReports`
 * yetkisi zaten ekip-çapında bir özet görme yetkisidir (Finans'ın rapor
 * uç noktasından farkı budur: Finans'ta rapor da kayıt bazlı görünürlüğe
 * tabidir, ama içerik modülünde raporlama ayrı bir yetkidir).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canViewModule, "Bu modülü görüntüleme yetkiniz yok.");
    assertContentPermission(permissions.canViewReports, "Raporları görüntüleme yetkiniz yok.");

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const dateWhere = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
    const hasRange = !!(from || to);

    const [social, blog, seo] = await Promise.all([
      prisma.socialContent.findMany({
        where: { teamId: workspace.id, deletedAt: null, ...(hasRange ? { createdAt: dateWhere } : {}) },
        select: {
          id: true,
          platform: true,
          status: true,
          createdById: true,
          createdBy: { select: { id: true, name: true, email: true } },
          performance: true,
        },
      }),
      prisma.blogContent.findMany({
        where: { teamId: workspace.id, deletedAt: null, ...(hasRange ? { createdAt: dateWhere } : {}) },
        select: { id: true, status: true, createdById: true, createdBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.seoWork.findMany({
        where: { teamId: workspace.id, deletedAt: null, ...(hasRange ? { createdAt: dateWhere } : {}) },
        select: { id: true, workType: true, status: true, createdById: true, createdBy: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    function statusBreakdown(rows: { status: string }[]) {
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
      return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
    }

    const platformMap = new Map<string, number>();
    for (const s of social) platformMap.set(s.platform, (platformMap.get(s.platform) ?? 0) + 1);

    const published = social.filter((s) => s.performance);
    const perfTotals = published.reduce(
      (acc, s) => {
        const p = s.performance!;
        acc.impressions += p.impressions ?? 0;
        acc.reach += p.reach ?? 0;
        acc.likes += p.likes ?? 0;
        acc.comments += p.comments ?? 0;
        acc.shares += p.shares ?? 0;
        acc.saves += p.saves ?? 0;
        acc.linkClicks += p.linkClicks ?? 0;
        acc.followerGain += p.followerGain ?? 0;
        return acc;
      },
      { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, linkClicks: 0, followerGain: 0 },
    );
    const avgEngagementRate =
      published.length > 0
        ? Math.round(
            (published.reduce((sum, s) => sum + (s.performance!.engagementRate ?? 0), 0) / published.length) * 100,
          ) / 100
        : 0;

    const personMap = new Map<string, { userId: string; name: string; contentCount: number }>();
    function addPerson(userId: string, name: string) {
      const p = personMap.get(userId) ?? { userId, name, contentCount: 0 };
      p.contentCount += 1;
      personMap.set(userId, p);
    }
    for (const s of social) addPerson(s.createdById, s.createdBy.name || s.createdBy.email);
    for (const b of blog) addPerson(b.createdById, b.createdBy.name || b.createdBy.email);
    for (const s of seo) addPerson(s.createdById, s.createdBy.name || s.createdBy.email);

    return NextResponse.json({
      counts: { social: social.length, blog: blog.length, seo: seo.length },
      statusBreakdown: {
        social: statusBreakdown(social),
        blog: statusBreakdown(blog),
        seo: statusBreakdown(seo),
      },
      platformBreakdown: Array.from(platformMap.entries()).map(([platform, count]) => ({ platform, count })),
      performance: {
        publishedCount: published.length,
        totals: perfTotals,
        avgEngagementRate,
      },
      byPerson: Array.from(personMap.values()).sort((a, b) => b.contentCount - a.contentCount),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
