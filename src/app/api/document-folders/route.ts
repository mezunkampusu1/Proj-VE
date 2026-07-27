import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getFolderAccessLevel } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentFolderSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

/**
 * GET: Kullanıcının erişebildiği klasörleri düz liste olarak döner
 * (istemci tarafında ağaç yapısına dönüştürülür — bkz. görev #158).
 * Erişim: sahiplik, izin kaydı veya kalıtım yoluyla erişilebilen tüm
 * klasörler + admin için hepsi.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const isAdmin = membership.role === "ADMIN";
    const allFolders = await prisma.documentFolder.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (isAdmin) {
      return NextResponse.json({ folders: allFolders });
    }

    const accessible: typeof allFolders = [];
    for (const folder of allFolders) {
      const level = await getFolderAccessLevel(session.user.id, folder.id);
      if (level) accessible.push(folder);
    }
    return NextResponse.json({ folders: accessible });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST: Yeni klasör oluşturur. Herhangi bir ekip üyesi kök seviyede veya erişebildiği bir klasörün altında klasör açabilir. */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = createDocumentFolderSchema.parse(body);

    if (data.parentFolderId && membership.role !== "ADMIN") {
      const level = await getFolderAccessLevel(session.user.id, data.parentFolderId);
      if (!level || (level !== "EDITOR" && level !== "OWNER")) {
        return NextResponse.json(
          { error: "Bu klasörün altında yeni klasör oluşturma yetkiniz yok." },
          { status: 403 },
        );
      }
    }

    const folder = await prisma.documentFolder.create({
      data: {
        name: data.name,
        parentFolderId: data.parentFolderId || undefined,
        teamId: workspace.id,
        createdById: session.user.id,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_FOLDER_CREATED",
      module: "DOCUMENTS",
      message: `"${folder.name}" klasörünü oluşturdu.`,
      ipAddress: getClientIp(req),
    });
    await logDocumentAudit({
      documentTitleSnapshot: folder.name,
      actorId: session.user.id,
      action: "CREATED",
      description: `Klasör oluşturuldu: ${folder.name}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
