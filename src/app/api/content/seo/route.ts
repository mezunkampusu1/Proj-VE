import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createSeoWorkSchema } from "@/lib/validations";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import {
  contentVisibilityWhere,
  notifyContentDueReminders,
  notifyContentUsers,
  relatedUserIds,
} from "@/lib/content";

/** Bağımsız SEO/GEO çalışmaları (blog'a bağlı olmayan) — bkz. proje talebi §8. */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(
      permissions.canViewModule && permissions.canManageSeo,
      "SEO modülünü görüntüleme yetkiniz yok.",
    );

    await notifyContentDueReminders(workspace.id);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const workType = searchParams.get("workType");
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
      roleFields: ["assignedToId", "approvedById"],
      mentionRelationField: "mentions",
    });

    const where = {
      teamId: workspace.id,
      deletedAt: null,
      ...visibility,
      ...(status ? { status: status as never } : {}),
      ...(workType ? { workType: workType as never } : {}),
      ...(brandId ? { brandId } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(personId
        ? {
            OR: [
              { createdById: personId },
              { assignedToId: personId },
              { approvedById: personId },
              { mentions: { some: { userId: personId } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.seoWork.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true, image: true } },
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { comments: true, assets: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.seoWork.count({ where }),
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
      permissions.canManageSeo && permissions.canCreateContent,
      "SEO çalışması oluşturma yetkiniz yok.",
    );

    const body = await req.json();
    const data = createSeoWorkSchema.parse(body);
    const mentionedUserIds = Array.from(new Set(data.mentionedUserIds ?? []));

    const content = await prisma.seoWork.create({
      data: {
        teamId: workspace.id,
        brandId: data.brandId || undefined,
        workType: data.workType,
        title: data.title,
        targetPage: data.targetPage ?? undefined,
        targetUrl: data.targetUrl || undefined,
        description: data.description ?? undefined,
        findings: data.findings ?? undefined,
        actionsTaken: data.actionsTaken ?? undefined,
        keywords: data.keywords ?? [],
        assignedToId: data.assignedToId || undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        priority: data.priority ?? undefined,
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
      message: `"${content.title}" SEO çalışması oluşturuldu.`,
      ipAddress: getClientIp(req),
    });

    const assignedIds = relatedUserIds({ roleUserIds: [data.assignedToId], excludeUserId: session.user.id });
    if (assignedIds.length > 0) {
      await notifyContentUsers(assignedIds, {
        type: "CONTENT_ASSIGNED",
        title: "Bir SEO çalışmasında görevlendirildiniz",
        message: `"${content.title}" SEO çalışmasında görevlendirildiniz.`,
        link: "/content/seo",
      });
    }

    const mentionOnlyIds = mentionedUserIds.filter(
      (id) => id !== session.user.id && !assignedIds.includes(id),
    );
    if (mentionOnlyIds.length > 0) {
      await notifyContentUsers(mentionOnlyIds, {
        type: "CONTENT_MENTIONED",
        title: "Bir SEO çalışmasında etiketlendiniz",
        message: `"${content.title}" SEO çalışmasında etiketlendiniz.`,
        link: "/content/seo",
      });
    }

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
