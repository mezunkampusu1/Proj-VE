import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createSocialContentSchema } from "@/lib/validations";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import {
  contentVisibilityWhere,
  isValidSocialContentType,
  notifyContentDueReminders,
  notifyContentUsers,
  relatedUserIds,
} from "@/lib/content";

/**
 * GET: Sosyal medya içeriklerinin listesi. Görünürlük `contentVisibilityWhere`
 * ile tekilleştirilmiştir (bkz. lib/content.ts) — admin veya
 * `canViewAllContent` her şeyi görür, aksi halde yalnızca kendi
 * oluşturduğu/isimli bir rolde atandığı/etiketlendiği/(izinliyse) aynı
 * departmandaki kayıtlar döner. Silinmiş (soft delete) kayıtlar hiçbir
 * zaman bu listede görünmez.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canViewModule, "Bu modülü görüntüleme yetkiniz yok.");

    // Yaklaşan yayınlar için hatırlatma taraması — gerçek bir cron yoktur,
    // Finans modülündeki desenle AYNI şekilde ana GET uç noktasının başında
    // tetiklenir (bkz. lib/content.ts notifyContentDueReminders).
    await notifyContentDueReminders(workspace.id);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const brandId = searchParams.get("brandId");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const personId = searchParams.get("personId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
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
      roleFields: ["designerId", "videoEditorId", "approvedById", "publishedById"],
      mentionRelationField: "mentions",
    });

    const where = {
      teamId: workspace.id,
      deletedAt: null,
      ...visibility,
      ...(status ? { status: status as never } : {}),
      ...(platform ? { platform: platform as never } : {}),
      ...(brandId ? { brandId } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(personId
        ? {
            OR: [
              { createdById: personId },
              { designerId: personId },
              { videoEditorId: personId },
              { approvedById: personId },
              { publishedById: personId },
              { mentions: { some: { userId: personId } } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            scheduledAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.socialContent.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          designer: { select: { id: true, name: true, email: true, image: true } },
          videoEditor: { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { comments: true, assets: true } },
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.socialContent.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Yeni sosyal medya içeriği oluşturur. Etiketlenen kullanıcılara ve
 * atanan tasarımcı/video editörüne bildirim gönderilir (bkz. proje talebi
 * §11/§15).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canCreateContent, "İçerik oluşturma yetkiniz yok.");

    const body = await req.json();
    const data = createSocialContentSchema.parse(body);

    if (!isValidSocialContentType(data.platform, data.contentType)) {
      return NextResponse.json(
        { error: "Seçilen platform için geçersiz içerik türü." },
        { status: 400 },
      );
    }

    const mentionedUserIds = Array.from(new Set(data.mentionedUserIds ?? []));

    const content = await prisma.socialContent.create({
      data: {
        teamId: workspace.id,
        brandId: data.brandId || undefined,
        platform: data.platform,
        contentType: data.contentType,
        title: data.title,
        postText: data.postText ?? undefined,
        shortDescription: data.shortDescription ?? undefined,
        longDescription: data.longDescription ?? undefined,
        hashtags: data.hashtags ?? [],
        mentionAccounts: data.mentionAccounts ?? [],
        location: data.location ?? undefined,
        linkUrl: data.linkUrl || undefined,
        ctaText: data.ctaText ?? undefined,
        targetAudience: data.targetAudience ?? undefined,
        contentGoal: data.contentGoal ?? undefined,
        campaign: data.campaign ?? undefined,
        keywords: data.keywords ?? [],
        altText: data.altText ?? undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        priority: data.priority ?? undefined,
        designerId: data.designerId || undefined,
        videoEditorId: data.videoEditorId || undefined,
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
      message: `"${content.title}" içeriği oluşturuldu (${content.platform}).`,
      ipAddress: getClientIp(req),
    });

    const assignedIds = relatedUserIds({
      roleUserIds: [data.designerId, data.videoEditorId],
      excludeUserId: session.user.id,
    });
    if (assignedIds.length > 0) {
      await notifyContentUsers(assignedIds, {
        type: "CONTENT_ASSIGNED",
        title: "Bir içerikte görevlendirildiniz",
        message: `"${content.title}" içeriğinde görevlendirildiniz.`,
        link: "/content/social",
      });
    }

    const mentionOnlyIds = mentionedUserIds.filter(
      (id) => id !== session.user.id && !assignedIds.includes(id),
    );
    if (mentionOnlyIds.length > 0) {
      await notifyContentUsers(mentionOnlyIds, {
        type: "CONTENT_MENTIONED",
        title: "Bir içerikte etiketlendiniz",
        message: `"${content.title}" içeriğinde etiketlendiniz.`,
        link: "/content/social",
      });
    }

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
