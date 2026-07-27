import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createBlogContentSchema } from "@/lib/validations";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import {
  contentVisibilityWhere,
  notifyContentDueReminders,
  notifyContentUsers,
  relatedUserIds,
} from "@/lib/content";

/**
 * Blog + SEO + GEO içerikleri — bkz. proje talebi §8. `canManageBlog`,
 * kullanıcının bu alana erişip erişemeyeceğini belirleyen "alan kapısı"dır;
 * genel `canCreateContent`/`canEditOwnContent`/vb. bayraklarla BİRLİKTE (AND)
 * uygulanır (bkz. lib/content-permissions.ts alan listesi).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(
      permissions.canViewModule && permissions.canManageBlog,
      "Blog modülünü görüntüleme yetkiniz yok.",
    );

    await notifyContentDueReminders(workspace.id);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const brandId = searchParams.get("brandId");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const personId = searchParams.get("personId");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "30") || 30));

    const viewer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { departmentId: true },
    });

    const visibility = contentVisibilityWhere({
      userId: session.user.id,
      role: membership.role,
      permissions,
      viewerDepartmentId: viewer?.departmentId ?? null,
      creatorField: "createdById",
      creatorRelationField: "createdBy",
      roleFields: ["editorId", "seoReviewedById", "approvedById"],
      mentionRelationField: "mentions",
    });

    const where = {
      teamId: workspace.id,
      deletedAt: null,
      ...visibility,
      ...(status ? { status: status as never } : {}),
      ...(brandId ? { brandId } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(personId
        ? {
            OR: [
              { createdById: personId },
              { editorId: personId },
              { seoReviewedById: personId },
              { approvedById: personId },
              { mentions: { some: { userId: personId } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.blogContent.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          editor: { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { comments: true, assets: true } },
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blogContent.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(
      permissions.canManageBlog && permissions.canCreateContent,
      "Blog içeriği oluşturma yetkiniz yok.",
    );

    const body = await req.json();
    const data = createBlogContentSchema.parse(body);
    const mentionedUserIds = Array.from(new Set(data.mentionedUserIds ?? []));

    const content = await prisma.blogContent.create({
      data: {
        teamId: workspace.id,
        brandId: data.brandId || undefined,
        title: data.title,
        summary: data.summary ?? undefined,
        body: data.body ?? undefined,
        category: data.category ?? undefined,
        targetPage: data.targetPage ?? undefined,
        slug: data.slug ?? undefined,
        focusKeyword: data.focusKeyword ?? undefined,
        secondaryKeywords: data.secondaryKeywords ?? [],
        searchIntent: data.searchIntent ?? undefined,
        targetAudience: data.targetAudience ?? undefined,
        metaTitle: data.metaTitle ?? undefined,
        metaDescription: data.metaDescription ?? undefined,
        h1: data.h1 ?? undefined,
        headingPlan: data.headingPlan ?? undefined,
        internalLinks: data.internalLinks ?? [],
        externalLinks: data.externalLinks ?? [],
        sources: data.sources ?? [],
        schemaType: data.schemaType ?? undefined,
        canonicalUrl: data.canonicalUrl || undefined,
        indexStatus: data.indexStatus ?? undefined,
        geoTargetQuestions: data.geoTargetQuestions ?? [],
        geoTargetAiQueries: data.geoTargetAiQueries ?? [],
        geoDirectAnswer: data.geoDirectAnswer ?? undefined,
        geoFaq: data.geoFaq ?? undefined,
        geoSourceCredibility: data.geoSourceCredibility ?? undefined,
        geoBrandUsage: data.geoBrandUsage ?? undefined,
        geoStructuredDataNotes: data.geoStructuredDataNotes ?? undefined,
        geoQuotableBlocks: data.geoQuotableBlocks ?? undefined,
        geoFreshnessDate: data.geoFreshnessDate ? new Date(data.geoFreshnessDate) : undefined,
        geoExpertReviewed: data.geoExpertReviewed ?? undefined,
        geoTrustedSources: data.geoTrustedSources ?? [],
        wordCount: data.wordCount ?? undefined,
        readingTimeMinutes: data.readingTimeMinutes ?? undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        priority: data.priority ?? undefined,
        editorId: data.editorId || undefined,
        internalNotes: data.internalNotes ?? undefined,
        createdById: session.user.id,
        mentions: mentionedUserIds.length > 0
          ? { create: mentionedUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        brand: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "CONTENT_CREATED",
      module: "CONTENT",
      message: `"${content.title}" blog içeriği oluşturuldu.`,
      ipAddress: getClientIp(req),
    });

    const assignedIds = relatedUserIds({ roleUserIds: [data.editorId], excludeUserId: session.user.id });
    if (assignedIds.length > 0) {
      await notifyContentUsers(assignedIds, {
        type: "CONTENT_ASSIGNED",
        title: "Bir blog içeriğinde görevlendirildiniz",
        message: `"${content.title}" blog içeriğinde görevlendirildiniz.`,
        link: "/content/blog",
      });
    }

    const mentionOnlyIds = mentionedUserIds.filter(
      (id) => id !== session.user.id && !assignedIds.includes(id),
    );
    if (mentionOnlyIds.length > 0) {
      await notifyContentUsers(mentionOnlyIds, {
        type: "CONTENT_MENTIONED",
        title: "Bir blog içeriğinde etiketlendiniz",
        message: `"${content.title}" blog içeriğinde etiketlendiniz.`,
        link: "/content/blog",
      });
    }

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
