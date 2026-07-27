import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import { contentVisibilityWhere } from "@/lib/content";

/**
 * İçerik Takvimi verisi — bkz. proje talebi §4. Tek ay için sosyal medya +
 * blog `scheduledAt` (yayın planı) ile SEO/site içi `dueDate` (son tarih)
 * kayıtlarını AYRI iki dizi olarak döner; takvim UI'ı bunları farklı
 * biçimde (yayın kartı vs son tarih rozeti) gösterir. Sürükle-bırak ile
 * tarih değişikliği doğrudan ilgili türün mevcut PATCH uç noktasını
 * kullanır (bkz. `/api/content/social/[contentId]`, `/blog/[contentId]`) —
 * burada yeni bir mutasyon uç noktası TEKRARLANMAZ.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canViewModule, "Bu modülü görüntüleme yetkiniz yok.");

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // "YYYY-MM"
    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split("-").map((n) => Number(n))
      : [now.getFullYear(), now.getMonth() + 1];
    // Takvim görünümünde ay başı/sonu haftaları da görünür olabildiği için
    // aralığı bir hafta önce/sonraya genişletiyoruz.
    const rangeStart = new Date(year, month - 1, 1);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(year, month, 1);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

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
    const [social, blog, seo] = await Promise.all([
      prisma.socialContent.findMany({
        where: {
          teamId: workspace.id,
          deletedAt: null,
          ...socialVisibility,
          scheduledAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, title: true, platform: true, status: true, scheduledAt: true, priority: true },
      }),
      prisma.blogContent.findMany({
        where: {
          teamId: workspace.id,
          deletedAt: null,
          ...blogVisibility,
          scheduledAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, title: true, status: true, scheduledAt: true, priority: true },
      }),
      prisma.seoWork.findMany({
        where: {
          teamId: workspace.id,
          deletedAt: null,
          ...seoVisibility,
          dueDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { id: true, title: true, workType: true, status: true, dueDate: true, priority: true },
      }),
    ]);

    const scheduled = [
      ...social.map((c) => ({
        id: c.id,
        kind: "social" as const,
        title: c.title,
        subtitle: c.platform,
        status: c.status,
        priority: c.priority,
        date: c.scheduledAt,
      })),
      ...blog.map((c) => ({
        id: c.id,
        kind: "blog" as const,
        title: c.title,
        subtitle: null,
        status: c.status,
        priority: c.priority,
        date: c.scheduledAt,
      })),
    ];

    const deadlines = [
      ...seo.map((c) => ({
        id: c.id,
        kind: "seo" as const,
        title: c.title,
        subtitle: c.workType,
        status: c.status,
        priority: c.priority,
        date: c.dueDate,
      })),
    ];

    return NextResponse.json({ scheduled, deadlines });
  } catch (error) {
    return handleApiError(error);
  }
}
