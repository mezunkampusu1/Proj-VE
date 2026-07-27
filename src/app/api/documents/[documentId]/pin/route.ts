import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logDocumentAudit } from "@/lib/document-audit";
import { getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * POST/DELETE: Sabitleme (pin) — bu doküman erişimi olan HERKES için
 * paylaşılan tek bir sabitleme durumudur (kişisel favorilerin aksine),
 * bkz. şemadaki `Document.isPinned` tekil alanı. En az EDITOR erişimi
 * gerektirir.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { isPinned: true, pinnedById: session.user.id, pinnedAt: new Date() },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EDITED",
      field: "isPinned",
      newValue: "true",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ isPinned: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { isPinned: false, pinnedById: null, pinnedAt: null },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EDITED",
      field: "isPinned",
      newValue: "false",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ isPinned: false });
  } catch (error) {
    return handleApiError(error);
  }
}
