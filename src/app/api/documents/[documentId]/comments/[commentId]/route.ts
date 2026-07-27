import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { updateDocumentCommentSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string; commentId: string }>;
}

const authorSelect = { id: true, name: true, email: true, image: true } as const;

/**
 * PATCH: Yorum metnini düzenler (yalnızca yazarı) veya çözüldü/yeniden
 * açıldı durumunu değiştirir (yazarı VEYA EDITOR/OWNER erişimi olan
 * herkes — bir düzenleyenin başka birinin yorumunu "çözüldü" işaretleyip
 * kapatabilmesi gerekir).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, commentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const comment = await prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.documentId !== documentId || comment.deletedAt) {
      throw new NotFoundError("Yorum bulunamadı.");
    }

    const body = await req.json();
    const data = updateDocumentCommentSchema.parse(body);

    if (data.body !== undefined && comment.authorId !== session.user.id) {
      throw new PermissionError("Yalnızca kendi yorumunuzu düzenleyebilirsiniz.");
    }
    if (data.resolved !== undefined) {
      const canResolve = comment.authorId === session.user.id || level === "EDITOR" || level === "OWNER";
      if (!canResolve) throw new PermissionError("Bu yorumu çözüldü işaretleme yetkiniz yok.");
    }

    const updated = await prisma.documentComment.update({
      where: { id: commentId },
      data: {
        body: data.body,
        resolved: data.resolved,
        resolvedById: data.resolved === undefined ? undefined : data.resolved ? session.user.id : null,
        resolvedAt: data.resolved === undefined ? undefined : data.resolved ? new Date() : null,
      },
      include: { author: { select: authorSelect }, resolvedBy: { select: { id: true, name: true } } },
    });

    if (data.resolved !== undefined) {
      const document = await prisma.document.findUnique({ where: { id: documentId }, select: { title: true } });
      await logDocumentAudit({
        documentId,
        documentTitleSnapshot: document?.title || "Doküman",
        actorId: session.user.id,
        action: "EDITED",
        field: "comment.resolved",
        newValue: String(data.resolved),
        ipAddress: getClientIp(req),
      });
      if (data.resolved && comment.authorId !== session.user.id) {
        await notifyDocumentUser({
          userId: comment.authorId,
          title: "Yorumunuz çözüldü işaretlendi",
          message: `"${document?.title}" dokümanındaki yorumunuz çözüldü olarak işaretlendi.`,
          link: `/ortak-alan/${documentId}`,
          type: "DOCUMENT_COMMENT",
        });
      }
    }

    return NextResponse.json({ comment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Yorumu yumuşak siler (yalnızca yazarı veya EDITOR/OWNER). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, commentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const comment = await prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.documentId !== documentId || comment.deletedAt) {
      throw new NotFoundError("Yorum bulunamadı.");
    }
    if (comment.authorId !== session.user.id && level !== "EDITOR" && level !== "OWNER") {
      throw new PermissionError("Bu yorumu silme yetkiniz yok.");
    }

    await prisma.documentComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

    const document = await prisma.document.findUnique({ where: { id: documentId }, select: { title: true } });
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document?.title || "Doküman",
      actorId: session.user.id,
      action: "COMMENT_DELETED",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document?.title}" dokümanındaki bir yorumu sildi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
