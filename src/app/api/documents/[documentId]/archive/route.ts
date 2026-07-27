import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logDocumentAudit } from "@/lib/document-audit";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * POST/DELETE: Arşivleme — çöp kutusundan (yumuşak silme) FARKLI bir
 * durum: arşivlenen doküman silinmez, yalnızca ana listelerden gizlenir
 * (bkz. `archivedAt`, documents/route.ts GET'teki filtre). Durum iş akışı
 * (`status: ARCHIVED`) ile karıştırılmamalı — o, dokümanın içerik durumunu
 * gösteren bir etikettir; bu ise yalnızca görünürlük/düzenleme kontrolü.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "EDITOR");
    if (level !== "OWNER" && level !== "EDITOR" && membership.role !== "ADMIN") {
      throw new PermissionError("Bu dokümanı arşivleme yetkiniz yok.");
    }

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { archivedAt: new Date() },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EDITED",
      field: "archivedAt",
      description: "Doküman arşivlendi.",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını arşivledi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Arşivden çıkarır. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "EDITOR");
    if (level !== "OWNER" && level !== "EDITOR" && membership.role !== "ADMIN") {
      throw new PermissionError("Bu dokümanı arşivden çıkarma yetkiniz yok.");
    }

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { archivedAt: null },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EDITED",
      field: "archivedAt",
      description: "Doküman arşivden çıkarıldı.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}
