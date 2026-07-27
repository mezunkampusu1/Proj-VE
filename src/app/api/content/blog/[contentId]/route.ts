import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { updateBlogContentSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import {
  requireBlogContentAccess,
  canEditContentRecord,
  canDeleteContentRecord,
  assertCanSetContentStatus,
  notifyContentUsers,
} from "@/lib/content";

interface Params {
  params: Promise<{ contentId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    await requireBlogContentAccess(contentId, session.user.id);

    const content = await prisma.blogContent.findUniqueOrThrow({
      where: { id: contentId },
      include: {
        brand: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        editor: { select: { id: true, name: true, email: true, image: true } },
        seoReviewedBy: { select: { id: true, name: true, email: true, image: true } },
        approvedBy: { select: { id: true, name: true, email: true, image: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      },
    });

    return NextResponse.json({ content });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    const { content: existing, membership, permissions } = await requireBlogContentAccess(
      contentId,
      session.user.id,
    );

    const body = await req.json();
    const data = updateBlogContentSchema.parse(body);

    const isCreator = existing.createdById === session.user.id;
    const canEdit = permissions.canManageBlog && canEditContentRecord(permissions, membership.role, isCreator);

    const { status: nextStatus, mentionedUserIds, ...fields } = data;
    const hasFieldChanges = Object.values(fields).some((v) => v !== undefined);
    const hasMentionChanges = mentionedUserIds !== undefined;

    if (hasFieldChanges || hasMentionChanges) {
      assertContentPermission(canEdit, "Bu blog içeriğini düzenleme yetkiniz yok.");
    }
    if (nextStatus && nextStatus !== existing.status) {
      assertCanSetContentStatus(permissions, canEdit, nextStatus);
    }

    const statusSideEffects: Record<string, unknown> = {};
    if (nextStatus && nextStatus !== existing.status) {
      if (nextStatus === "APPROVED") statusSideEffects.approvedById = session.user.id;
      if (nextStatus === "PUBLISHED") statusSideEffects.publishedAt = new Date();
    }

    let mentionDiff: { added: string[]; removed: string[] } | null = null;
    if (hasMentionChanges) {
      const previous = await prisma.contentMention.findMany({
        where: { blogContentId: contentId },
        select: { userId: true },
      });
      const previousIds = previous.map((m) => m.userId);
      const nextIds = Array.from(new Set(mentionedUserIds ?? []));
      mentionDiff = {
        added: nextIds.filter((id) => !previousIds.includes(id)),
        removed: previousIds.filter((id) => !nextIds.includes(id)),
      };
    }

    const content = await prisma.blogContent.update({
      where: { id: contentId },
      data: {
        ...fields,
        canonicalUrl: fields.canonicalUrl === "" ? null : fields.canonicalUrl,
        publishUrl: data.publishUrl === "" ? null : data.publishUrl,
        scheduledAt: data.scheduledAt !== undefined ? (data.scheduledAt ? new Date(data.scheduledAt) : null) : undefined,
        geoFreshnessDate:
          data.geoFreshnessDate !== undefined
            ? data.geoFreshnessDate
              ? new Date(data.geoFreshnessDate)
              : null
            : undefined,
        status: nextStatus ?? undefined,
        ...statusSideEffects,
        ...(mentionDiff
          ? {
              mentions: {
                deleteMany: mentionDiff.removed.length > 0 ? { userId: { in: mentionDiff.removed } } : undefined,
                create: mentionDiff.added.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      include: {
        brand: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        editor: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: nextStatus && nextStatus !== existing.status ? "CONTENT_STATUS_CHANGED" : "CONTENT_UPDATED",
      module: "CONTENT",
      message:
        nextStatus && nextStatus !== existing.status
          ? `"${content.title}" blog içeriğinin durumu değişti (${existing.status} → ${nextStatus}).`
          : `"${content.title}" blog içeriği güncellendi.`,
      ipAddress: getClientIp(req),
    });

    if (mentionDiff && mentionDiff.added.length > 0) {
      const newMentions = mentionDiff.added.filter((id) => id !== session.user.id);
      if (newMentions.length > 0) {
        await notifyContentUsers(newMentions, {
          type: "CONTENT_MENTIONED",
          title: "Bir blog içeriğinde etiketlendiniz",
          message: `"${content.title}" blog içeriğinde etiketlendiniz.`,
          link: "/content/blog",
        });
      }
    }

    if (nextStatus && nextStatus !== existing.status && existing.createdById !== session.user.id) {
      if (nextStatus === "APPROVED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_APPROVED",
          title: "Blog içeriğiniz onaylandı",
          message: `"${content.title}" blog içeriğiniz onaylandı.`,
          link: "/content/blog",
        });
      }
      if (nextStatus === "REVISION_REQUESTED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REVISION_REQUESTED",
          title: "Blog içeriğinizde revizyon istendi",
          message: `"${content.title}" blog içeriğiniz için revizyon istendi.`,
          link: "/content/blog",
        });
      }
      if (nextStatus === "CANCELLED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REJECTED",
          title: "Blog içeriğiniz iptal edildi",
          message: `"${content.title}" blog içeriğiniz iptal edildi.`,
          link: "/content/blog",
        });
      }
    }

    return NextResponse.json({ content });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    const { content: existing, membership, permissions } = await requireBlogContentAccess(
      contentId,
      session.user.id,
    );

    const isCreator = existing.createdById === session.user.id;
    assertContentPermission(
      permissions.canManageBlog && canDeleteContentRecord(permissions, membership.role, isCreator),
      "Bu blog içeriğini silme yetkiniz yok.",
    );

    await prisma.blogContent.update({ where: { id: contentId }, data: { deletedAt: new Date() } });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: "CONTENT_DELETED",
      module: "CONTENT",
      message: `"${existing.title}" blog içeriği silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
