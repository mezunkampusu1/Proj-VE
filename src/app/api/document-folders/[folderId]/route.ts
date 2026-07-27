import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireFolderAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { updateDocumentFolderSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ folderId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { folderId } = await params;
    await requireFolderAccess(folderId, session.user.id, "VIEWER");

    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: {
        childFolders: { where: { deletedAt: null }, orderBy: { name: "asc" } },
        documents: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
        permissions: true,
      },
    });
    if (!folder) throw new NotFoundError("Klasör bulunamadı.");

    return NextResponse.json({ folder });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH: Klasörü yeniden adlandırır veya taşır (EDITOR/OWNER gerektirir). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { folderId } = await params;
    await requireFolderAccess(folderId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = updateDocumentFolderSchema.parse(body);

    if (data.parentFolderId === folderId) {
      return NextResponse.json({ error: "Bir klasör kendi altına taşınamaz." }, { status: 400 });
    }

    const existing = await prisma.documentFolder.findUnique({ where: { id: folderId } });
    if (!existing) throw new NotFoundError("Klasör bulunamadı.");

    const folder = await prisma.documentFolder.update({
      where: { id: folderId },
      data: {
        name: data.name,
        parentFolderId: data.parentFolderId === undefined ? undefined : data.parentFolderId || null,
      },
    });

    await logDocumentAudit({
      documentTitleSnapshot: folder.name,
      actorId: session.user.id,
      action: "EDITED",
      field: "folder",
      oldValue: existing.name,
      newValue: folder.name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ folder });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Klasörü (ve içindekileri) yumuşak siler — çöp kutusundan geri alınabilir. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { folderId } = await params;
    const level = await requireFolderAccess(folderId, session.user.id, "EDITOR");
    if (level !== "OWNER" && level !== "EDITOR") {
      throw new PermissionError("Bu klasörü silme yetkiniz yok.");
    }

    const folder = await prisma.documentFolder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });
    await prisma.document.updateMany({
      where: { folderId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await logDocumentAudit({
      documentTitleSnapshot: folder.name,
      actorId: session.user.id,
      action: "DELETED",
      description: `Klasör çöp kutusuna taşındı: ${folder.name}`,
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_DELETED",
      module: "DOCUMENTS",
      message: `"${folder.name}" klasörünü çöp kutusuna taşıdı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
