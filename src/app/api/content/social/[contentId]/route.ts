import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { updateSocialContentSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import {
  requireSocialContentAccess,
  canEditContentRecord,
  canDeleteContentRecord,
  assertCanSetContentStatus,
  isValidSocialContentType,
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
    await requireSocialContentAccess(contentId, session.user.id);

    const content = await prisma.socialContent.findUniqueOrThrow({
      where: { id: contentId },
      include: {
        brand: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        designer: { select: { id: true, name: true, email: true, image: true } },
        videoEditor: { select: { id: true, name: true, email: true, image: true } },
        approvedBy: { select: { id: true, name: true, email: true, image: true } },
        publishedBy: { select: { id: true, name: true, email: true, image: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        performance: true,
      },
    });

    return NextResponse.json({ content });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH: Alan güncellemesi VE durum geçişi aynı uç noktadan yapılır —
 * ikisinin yetki kontrolü farklıdır (bkz. `assertCanSetContentStatus`).
 * Onaylandı/yayınlandı durumlarına geçişte ilgili "kim onayladı/yayınladı"
 * alanı otomatik doldurulur.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    const { content: existing, membership, permissions } = await requireSocialContentAccess(
      contentId,
      session.user.id,
    );

    const body = await req.json();
    const data = updateSocialContentSchema.parse(body);

    const isCreator = existing.createdById === session.user.id;
    const canEdit = canEditContentRecord(permissions, membership.role, isCreator);

    const { status: nextStatus, mentionedUserIds, ...fields } = data;
    const hasFieldChanges = Object.values(fields).some((v) => v !== undefined);
    const hasMentionChanges = mentionedUserIds !== undefined;

    if (hasFieldChanges || hasMentionChanges) {
      assertContentPermission(canEdit, "Bu içeriği düzenleme yetkiniz yok.");
    }
    if (nextStatus && nextStatus !== existing.status) {
      assertCanSetContentStatus(permissions, canEdit, nextStatus);
    }

    const finalPlatform = data.platform ?? existing.platform;
    const finalContentType = data.contentType ?? existing.contentType;
    if (
      (data.platform || data.contentType) &&
      !isValidSocialContentType(finalPlatform, finalContentType)
    ) {
      return NextResponse.json(
        { error: "Seçilen platform için geçersiz içerik türü." },
        { status: 400 },
      );
    }

    const statusSideEffects: Record<string, unknown> = {};
    if (nextStatus && nextStatus !== existing.status) {
      if (nextStatus === "APPROVED") statusSideEffects.approvedById = session.user.id;
      if (nextStatus === "PUBLISHED") {
        statusSideEffects.publishedById = session.user.id;
        statusSideEffects.publishedAt = new Date();
      }
    }

    let mentionDiff: { added: string[]; removed: string[] } | null = null;
    if (hasMentionChanges) {
      const previous = await prisma.contentMention.findMany({
        where: { socialContentId: contentId },
        select: { userId: true },
      });
      const previousIds = previous.map((m) => m.userId);
      const nextIds = Array.from(new Set(mentionedUserIds ?? []));
      mentionDiff = {
        added: nextIds.filter((id) => !previousIds.includes(id)),
        removed: previousIds.filter((id) => !nextIds.includes(id)),
      };
    }

    const content = await prisma.socialContent.update({
      where: { id: contentId },
      data: {
        ...fields,
        linkUrl: fields.linkUrl === "" ? null : fields.linkUrl,
        publishUrl: fields.publishUrl === "" ? null : fields.publishUrl,
        scheduledAt: data.scheduledAt !== undefined ? (data.scheduledAt ? new Date(data.scheduledAt) : null) : undefined,
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
        designer: { select: { id: true, name: true, email: true, image: true } },
        videoEditor: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: nextStatus && nextStatus !== existing.status ? "CONTENT_STATUS_CHANGED" : "CONTENT_UPDATED",
      module: "CONTENT",
      message:
        nextStatus && nextStatus !== existing.status
          ? `"${content.title}" içeriğinin durumu değişti (${existing.status} → ${nextStatus}).`
          : `"${content.title}" içeriği güncellendi.`,
      ipAddress: getClientIp(req),
    });

    if (mentionDiff && mentionDiff.added.length > 0) {
      const newMentions = mentionDiff.added.filter((id) => id !== session.user.id);
      if (newMentions.length > 0) {
        await notifyContentUsers(newMentions, {
          type: "CONTENT_MENTIONED",
          title: "Bir içerikte etiketlendiniz",
          message: `"${content.title}" içeriğinde etiketlendiniz.`,
          link: "/content/social",
        });
      }
    }

    if (nextStatus && nextStatus !== existing.status && existing.createdById !== session.user.id) {
      if (nextStatus === "APPROVED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_APPROVED",
          title: "İçeriğiniz onaylandı",
          message: `"${content.title}" içeriğiniz onaylandı.`,
          link: "/content/social",
        });
      }
      if (nextStatus === "REVISION_REQUESTED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REVISION_REQUESTED",
          title: "İçeriğinizde revizyon istendi",
          message: `"${content.title}" içeriğiniz için revizyon istendi.`,
          link: "/content/social",
        });
      }
      if (nextStatus === "CANCELLED") {
        await notifyContentUsers([existing.createdById], {
          type: "CONTENT_REJECTED",
          title: "İçeriğiniz iptal edildi",
          message: `"${content.title}" içeriğiniz iptal edildi.`,
          link: "/content/social",
        });
      }
    }

    return NextResponse.json({ content });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: soft delete — bkz. proje talebi §14 (kalıcı silme ayrı, yalnızca en üst yetki). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    const { content: existing, membership, permissions } = await requireSocialContentAccess(
      contentId,
      session.user.id,
    );

    const isCreator = existing.createdById === session.user.id;
    assertContentPermission(
      canDeleteContentRecord(permissions, membership.role, isCreator),
      "Bu içeriği silme yetkiniz yok.",
    );

    await prisma.socialContent.update({
      where: { id: contentId },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: "CONTENT_DELETED",
      module: "CONTENT",
      message: `"${existing.title}" içeriği silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
