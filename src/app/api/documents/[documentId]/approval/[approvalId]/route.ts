import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { decideApprovalRequestSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";
import type { DocumentAuditAction, DocumentStatus } from "@prisma/client";

interface Params {
  params: Promise<{ documentId: string; approvalId: string }>;
}

const authorSelect = { id: true, name: true, email: true } as const;

/**
 * PATCH: Onay kararı verir (APPROVED / REVISION_REQUESTED / REJECTED) ya da
 * talebi geri çeker (WITHDRAWN). Karar verme yönetici (ADMIN) yetkisi
 * gerektirir; geri çekme ise talebi açan kişiye özeldir — bu tek route'ta
 * iki farklı yetki kuralı olduğu için elle dallanıyoruz (requireTeamAdmin
 * burada kullanılamıyor çünkü WITHDRAWN durumunda admin olmayan talep
 * sahibi de işlem yapabilmeli).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId, approvalId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.documentId !== documentId) {
      throw new NotFoundError("Onay talebi bulunamadı.");
    }
    if (approval.status !== "PENDING") {
      return NextResponse.json({ error: "Bu talep zaten karara bağlanmış." }, { status: 409 });
    }

    const body = await req.json();
    const data = decideApprovalRequestSchema.parse(body);

    const isRequester = approval.requestedById === session.user.id;
    const isAdmin = membership.role === "ADMIN";

    if (data.decision === "WITHDRAWN") {
      if (!isRequester) {
        throw new PermissionError("Bir onay talebini yalnızca talep sahibi geri çekebilir.");
      }
    } else if (!isAdmin) {
      throw new PermissionError("Onay kararı vermek için takım yöneticisi olmanız gerekir.");
    }

    const nextDocumentStatus: DocumentStatus =
      data.decision === "APPROVED"
        ? "APPROVED"
        : data.decision === "REVISION_REQUESTED"
          ? "BEING_REVISED"
          : "DRAFT"; // REJECTED veya WITHDRAWN — taslağa geri döner

    const [updatedApproval] = await prisma.$transaction([
      prisma.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: data.decision,
          decisionNote: data.note || undefined,
          decidedById: data.decision === "WITHDRAWN" ? undefined : session.user.id,
          decidedAt: new Date(),
        },
        include: {
          requestedBy: { select: authorSelect },
          currentApprover: { select: authorSelect },
          decidedBy: { select: authorSelect },
        },
      }),
      prisma.document.update({ where: { id: documentId }, data: { status: nextDocumentStatus } }),
    ]);

    const auditAction: DocumentAuditAction =
      data.decision === "APPROVED"
        ? "APPROVAL_GRANTED"
        : data.decision === "REVISION_REQUESTED"
          ? "REVISION_REQUESTED"
          : data.decision === "REJECTED"
            ? "APPROVAL_REJECTED"
            : "APPROVAL_REQUESTED"; // WITHDRAWN için ayrı bir enum değeri yok; geri çekme olayı note alanında ayırt edilir

    const ip = getClientIp(req);
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: auditAction,
      description: data.decision === "WITHDRAWN" ? "Onay talebi geri çekildi." : data.note || undefined,
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_STATUS_CHANGED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanı için onay kararı: ${data.decision}.`,
      ipAddress: ip,
    });

    if (data.decision !== "WITHDRAWN" && approval.requestedById !== session.user.id) {
      const decisionLabel =
        data.decision === "APPROVED"
          ? "onaylandı"
          : data.decision === "REVISION_REQUESTED"
            ? "revizyon talep edildi"
            : "reddedildi";
      await notifyDocumentUser({
        userId: approval.requestedById,
        title: "Onay kararı verildi",
        message: `"${document.title}" dokümanınız için: ${decisionLabel}${data.note ? ` — ${data.note}` : ""}`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_APPROVAL",
      });
    }

    return NextResponse.json({ approval: updatedApproval });
  } catch (error) {
    return handleApiError(error);
  }
}
