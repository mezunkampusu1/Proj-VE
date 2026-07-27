import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * POST: Çöp kutusundaki bir dokümanı geri yükler. Yalnızca sahibi veya
 * yönetici geri yükleyebilir (silinmiş bir doküman için normal izin
 * kontrolü çalışmaz — deletedAt dolu olduğu sürece getDocumentAccessLevel
 * her zaman null döner, bu yüzden burada doğrudan sahiplik/admin kontrolü
 * yapılır).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundError("Doküman bulunamadı.");
    if (!document.deletedAt) {
      return NextResponse.json({ error: "Bu doküman zaten çöp kutusunda değil." }, { status: 400 });
    }
    if (document.ownerId !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu dokümanı geri yükleme yetkiniz yok.");
    }

    const restored = await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: null },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: restored.title,
      actorId: session.user.id,
      action: "RESTORED",
      description: "Doküman çöp kutusundan geri yüklendi.",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_RESTORED",
      module: "DOCUMENTS",
      message: `"${restored.title}" dokümanını geri yükledi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ document: restored });
  } catch (error) {
    return handleApiError(error);
  }
}
