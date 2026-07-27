import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string; permissionId: string }>;
}

/** DELETE: Bir paylaşım kaydını iptal eder (yetki her zaman geri alınabilir — §10). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, permissionId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const permission = await prisma.documentPermission.findUnique({ where: { id: permissionId } });
    if (!permission || permission.documentId !== documentId) {
      throw new NotFoundError("Paylaşım kaydı bulunamadı.");
    }
    if (permission.level === "OWNER" && level !== "OWNER") {
      throw new PermissionError("Sahiplik düzeyindeki bir yetkiyi yalnızca doküman sahibi kaldırabilir.");
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    await prisma.documentPermission.delete({ where: { id: permissionId } });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document?.title || "Doküman",
      actorId: session.user.id,
      action: "PERMISSION_REVOKED",
      oldValue: `${permission.subjectType}:${permission.subjectUserId || permission.subjectTeamId || permission.subjectRole || "EVERYONE"} (${permission.level})`,
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_SHARED",
      module: "DOCUMENTS",
      message: `"${document?.title}" dokümanındaki bir paylaşımı kaldırdı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
