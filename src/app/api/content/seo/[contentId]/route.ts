import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { updateSeoWorkSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import {
  requireSeoWorkAccess,
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
    await requireSeoWorkAccess(contentId, session.user.id);

    const content = await prisma.seoWork.findUniqueOrThrow({
      where: { id: contentId },
      include: {
        brand: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
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
    const { content: existing, membership, permissions } = await requireSeoWorkAccess(
      contentId,
      session.user.id,
    );

    const body = await req.json();
    const data = updateSeoWorkSchema.parse(body);

    const isCreator = existing.createdById === session.user.id;
    const canEdit = permissions.canManageSeo && canEditContentRecord(permissions, membership.role, isCreator);

    const { status: nextStatus, mentionedUserIds, ...fields } = data;
    const hasFieldChanges = Object.values(fields).some((v) => v !== undefined);
    const hasMentionChanges = mentionedUserIds !== undefined;

    if (hasFieldChanges || hasMentionChanges) {
      assertContentPermission(canEdit, "Bu SEO çalışmasını düzenleme yetkiniz yok.");
    }
    if (nextStatus && nextStatus !== existing.status) {
      assertCanSetContentStatus(permissions, canEdit, nextStatus);
    }

    const statusSideEffects: Record<string, unknown> = {};
    if (nextStatus && nextStatus !== existing.status) {
      if (nextStatus === "APPROVED") statusSideEffects.approvedById = session.user.id;
      if (nextStatus === "PUBLISHED") statusSideEffects.completedAt = new Date();
    }

    let mentionDiff: { added: string[]; removed: string[] } | null = null;
    if (hasMentionChanges) {
      const previous = await prisma.contentMention.findMany({
        where: { seoWorkId: contentId },
        select: { userId: true },
      });
      const previousIds = previous.map((m) => m.userId);
      const nextIds = Array.from(new Set(mentionedUserIds ?? []));
      mentionDiff = {
        added: nextIds.filter((id) => !previousIds.includes(id)),
        removed: previousIds.filter((id) => !nextIds.includes(id)),
      };
    }

    const content = await prisma.seoWork.update({
      where: { id: contentId },
      data: {
        ...fields,
        targetUrl: fields.targetUrl === "" ? null : fields.targetUrl,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
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
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: nextStatus && nextStatus !== existing.status ? "CONTENT_STATUS_CHANGED" : "CONTENT_UPDATED",
      module: "CONTENT",
      message:
        nextStatus && nextStatus !== existing.status
          ? `"${content.title}" SEO çalışmasının durumu değişti (${existing.status} → ${nextStatus}).`
          : `"${content.title}" SEO çalışması güncellendi.`,
      ipAddress: getClientIp(req),
    });

    if (mentionDiff && mentionDiff.added.length > 0) {
      const newMentions = mentionDiff.added.filter((id) => id !== session.user.id);
      if (newMentions.length > 0) {
        await notifyContentUsers(newMentions, {
          type: "CONTENT_MENTIONED",
          title: "Bir SEO çalışmasında etiketlendiniz",
          message: `"${content.title}" SEO çalışmasında etiketlendiniz.`,
          link: "/content/seo",
        });
      }
    }

    if (nextStatus && nextStatus !== existing.status && existing.createdById !== session.user.id) {
      if (nextStatus === "APPROVED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_APPROVED",
          title: "SEO çalışmanız onaylandı",
          message: `"${content.title}" SEO çalışmanız onaylandı.`,
          link: "/content/seo",
        });
      }
      if (nextStatus === "REVISION_REQUESTED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REVISION_REQUESTED",
          title: "SEO çalışmanızda revizyon istendi",
          message: `"${content.title}" SEO çalışmanız için revizyon istendi.`,
          link: "/content/seo",
        });
      }
      if (nextStatus === "CANCELLED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REJECTED",
          title: "SEO çalışmanız iptal edildi",
          message: `"${content.title}" SEO çalışmanız iptal edildi.`,
          link: "/content/seo",
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
    const { content: existing, membership, permissions } = await requireSeoWorkAccess(
      contentId,
      session.user.id,
    );

    const isCreator = existing.createdById === session.user.id;
    assertContentPermission(
      permissions.canManageSeo && canDeleteContentRecord(permissions, membership.role, isCreator),
      "Bu SEO çalışmasını silme yetkiniz yok.",
    );

    await prisma.seoWork.update({ where: { id: contentId }, data: { deletedAt: new Date() } });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: "CONTENT_DELETED",
      module: "CONTENT",
      message: `"${existing.title}" SEO çalışması silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
