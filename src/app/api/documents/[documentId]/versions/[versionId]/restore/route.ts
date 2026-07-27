import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string; versionId: string }>;
}

/**
 * POST: Bir sürümü geri yükler — ASLA yıkıcı değildir (§8 "restore-as-
 * new-version, hiçbir zaman üzerine yazmaz"). Önce mevcut durumun bir
 * güvenlik anlık görüntüsü alınır, sonra hedef sürümün içeriği istemciye
 * döndürülür. Gerçek uygulama (Yjs belgesine yazma) istemci tarafında
 * `editor.commands.setContent(...)` ile yapılır — tıpkı ilk içerik ekimi
 * gibi (bkz. collaborative-editor.tsx) — çünkü canlı belge durumunun tek
 * yetkili sahibi collab servisidir; bu API sunucusu doğrudan Yjs
 * belgesini değiştirmez.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, versionId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    if (!version || version.documentId !== documentId) {
      throw new NotFoundError("Sürüm bulunamadı.");
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    // Güvenlik anlık görüntüsü: geri yükleme öncesi o anki durum kaybolmasın.
    await prisma.documentVersion.create({
      data: {
        documentId,
        label: `Geri yükleme öncesi otomatik yedek (${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})`,
        isAutoSnapshot: true,
        content: document.content ?? {},
        contentText: document.contentText,
        createdById: session.user.id,
      },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "VERSION_RESTORED",
      oldValue: document.contentText?.slice(0, 200),
      newValue: version.contentText?.slice(0, 200),
      description: `"${version.label || "Otomatik anlık görüntü"}" sürümüne geri dönüldü.`,
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını "${version.label || "önceki bir sürüme"}" geri yükledi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ content: version.content, label: version.label });
  } catch (error) {
    return handleApiError(error);
  }
}
