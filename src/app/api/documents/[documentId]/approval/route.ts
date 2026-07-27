import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createApprovalRequestSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

const authorSelect = { id: true, name: true, email: true } as const;

/**
 * GET: Onay geçmişinin TAMAMI (§15 "tam geçmiş" — bekleyen + karara
 * bağlanmış tüm talepler, hiçbiri silinmez).
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const requests = await prisma.approvalRequest.findMany({
      where: { documentId },
      include: {
        requestedBy: { select: authorSelect },
        currentApprover: { select: authorSelect },
        decidedBy: { select: authorSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Onaya gönderir (§15 "submit → yönetici incelemesi → tamamlandı").
 * Bu projede ayrı bir "takım yöneticisi" rolü yoktur (bkz. proje kararı:
 * diğer modüllerde de — Günlük Akış vb. — bu görev mevcut ADMIN rolüne
 * katlanmıştır); bu yüzden onay tek aşamalıdır: herhangi bir yönetici
 * (ADMIN) karar verebilir. `currentApproverId` belirtilirse bildirim
 * doğrudan ona gider, belirtilmezse tüm yöneticilere gider.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const existingPending = await prisma.approvalRequest.findFirst({
      where: { documentId, status: "PENDING" },
    });
    if (existingPending) {
      return NextResponse.json({ error: "Bu doküman için zaten bekleyen bir onay talebi var." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const data = createApprovalRequestSchema.parse(body);

    if (data.currentApproverId) {
      const approverMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: workspace.id, userId: data.currentApproverId } },
      });
      if (!approverMembership || approverMembership.role !== "ADMIN") {
        return NextResponse.json({ error: "Seçilen onaylayan bir yönetici olmalı." }, { status: 400 });
      }
    }

    const approval = await prisma.approvalRequest.create({
      data: {
        documentId,
        requestedById: session.user.id,
        currentApproverId: data.currentApproverId || undefined,
      },
      include: { requestedBy: { select: authorSelect } },
    });

    await prisma.document.update({ where: { id: documentId }, data: { status: "PENDING_APPROVAL" } });

    const ip = getClientIp(req);
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "APPROVAL_REQUESTED",
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_STATUS_CHANGED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını onaya gönderdi.`,
      ipAddress: ip,
    });

    const approverIds = data.currentApproverId
      ? [data.currentApproverId]
      : (
          await prisma.teamMember.findMany({ where: { teamId: workspace.id, role: "ADMIN" }, select: { userId: true } })
        ).map((m) => m.userId);

    for (const userId of approverIds) {
      if (userId === session.user.id) continue;
      await notifyDocumentUser({
        userId,
        title: "Onayınız bekleniyor",
        message: `"${document.title}" dokümanı onayınızı bekliyor.`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_APPROVAL",
      });
    }

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
