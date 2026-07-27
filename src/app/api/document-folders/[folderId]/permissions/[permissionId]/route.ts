import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireFolderAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ folderId: string; permissionId: string }>;
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { folderId, permissionId } = await params;
    const level = await requireFolderAccess(folderId, session.user.id, "EDITOR");

    const permission = await prisma.documentPermission.findUnique({ where: { id: permissionId } });
    if (!permission || permission.folderId !== folderId) {
      throw new NotFoundError("Paylaşım kaydı bulunamadı.");
    }
    if (permission.level === "OWNER" && level !== "OWNER") {
      throw new PermissionError("Sahiplik düzeyindeki bir yetkiyi yalnızca klasör sahibi kaldırabilir.");
    }

    const folder = await prisma.documentFolder.findUnique({ where: { id: folderId } });
    await prisma.documentPermission.delete({ where: { id: permissionId } });

    await logDocumentAudit({
      documentTitleSnapshot: folder?.name || "Klasör",
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
      message: `"${folder?.name}" klasöründeki bir paylaşımı kaldırdı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
