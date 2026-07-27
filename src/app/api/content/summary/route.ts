import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import { contentVisibilityWhere, notifyContentDueReminders } from "@/lib/content";

/**
 * İçerik modülü özet uç noktası — artık ayrı bir "Genel Bakış" sayfası değil,
 * ana Panel'deki (bkz. `dashboard/page.tsx`) "Sosyal Medya & İçerik"
 * bölümünü besler. Her sayım, o türün kendi görünürlük kuralına
 * (`contentVisibilityWhere`) göre hesaplanır; kullanıcı göremediği bir
 * kaydı sayaçlarda da görmez. Onay Bekleyenler & Atamalar sayfası ve Günlük
 * Çalışma Raporları modülü kaldırıldığı için buradaki karşılık gelen
 * sayımlar da (pendingApprovalCount, assignedToMeCount, todayReportStatus)
 * kaldırıldı. Revizyon #325: Site İçi Çalışmalar modülü komple kaldırıldığı
 * için websiteWork sayımı/yaklaşanları da kaldırıldı.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canViewModule, "Bu modülü görüntüleme yetkiniz yok.");

    await notifyContentDueReminders(workspace.id);

    const viewer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { departmentId: true },
    });

    const socialVisibility = contentVisibilityWhere({
      userId: session.user.id,
      role: membership.role,
      permissions,
      viewerDepartmentId: viewer?.departmentId ?? null,
      creatorField: "createdById",
      creatorRelationField: "createdBy",
      roleFields: ["designerId", "videoEditorId", "approvedById", "publishedById"],
      mentionRelationField: "mentions",
    });
    const blogVisibility = contentVisibilityWhere({
      userId: session.user.id,
      role: membership.role,
      permissions,
      viewerDepartmentId: viewer?.departmentId ?? null,
      creatorField: "createdById",
      creatorRelationField: "createdBy",
      roleFields: ["editorId", "seoReviewedById", "approvedById"],
      mentionRelationField: "mentions",
    });
    const seoVisibility = contentVisibilityWhere({
      userId: session.user.id,
      role: membership.role,
      permissions,
      viewerDepartmentId: viewer?.departmentId ?? null,
      creatorField: "createdById",
      creatorRelationField: "createdBy",
      roleFields: ["assignedToId", "approvedById"],
      mentionRelationField: "mentions",
    });
    const socialWhere = { teamId: workspace.id, deletedAt: null, ...socialVisibility };
    const blogWhere = { teamId: workspace.id, deletedAt: null, ...blogVisibility };
    const seoWhere = { teamId: workspace.id, deletedAt: null, ...seoVisibility };

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      socialCount,
      blogCount,
      seoCount,
      socialStatusGroups,
      mentionedCount,
      upcomingSocial,
      upcomingBlog,
      upcomingSeo,
    ] = await Promise.all([
      prisma.socialContent.count({ where: socialWhere }),
      prisma.blogContent.count({ where: blogWhere }),
      prisma.seoWork.count({ where: seoWhere }),
      prisma.socialContent.groupBy({ by: ["status"], where: socialWhere, _count: { _all: true } }),
      prisma.contentMention.count({ where: { userId: session.user.id } }),
      prisma.socialContent.findMany({
        where: { ...socialWhere, status: "SCHEDULED", scheduledAt: { gte: now, lte: in7Days } },
        select: { id: true, title: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      prisma.blogContent.findMany({
        where: { ...blogWhere, status: "SCHEDULED", scheduledAt: { gte: now, lte: in7Days } },
        select: { id: true, title: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      prisma.seoWork.findMany({
        where: { ...seoWhere, status: { notIn: ["PUBLISHED", "CANCELLED", "ARCHIVED"] }, dueDate: { gte: now, lte: in7Days } },
        select: { id: true, title: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
    ]);

    const upcoming = [
      ...upcomingSocial.map((c) => ({ id: c.id, kind: "social" as const, title: c.title, date: c.scheduledAt })),
      ...upcomingBlog.map((c) => ({ id: c.id, kind: "blog" as const, title: c.title, date: c.scheduledAt })),
      ...upcomingSeo.map((c) => ({ id: c.id, kind: "seo" as const, title: c.title, date: c.dueDate })),
    ].sort((a, b) => (a.date && b.date ? new Date(a.date).getTime() - new Date(b.date).getTime() : 0));

    return NextResponse.json({
      counts: { social: socialCount, blog: blogCount, seo: seoCount },
      mentionedCount,
      statusBreakdown: socialStatusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      upcoming: upcoming.slice(0, 8),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
