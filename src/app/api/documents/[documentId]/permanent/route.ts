import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logDocumentAudit } from "@/lib/document-audit";
import { getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * DELETE: Kalıcı silme — geri alınamaz. Spesifikasyon gereği bu işlem
 * yetkiye göre kısıtlanmıştır: yalnızca yöneticiler kalıcı silme
 * yapabilir (§17 "hard-delete yalnızca yetkiye göre kısıtlanmalı, tüm
 * işlemler loglanmalı"). Doküman çöp kutusunda olmalıdır.
 */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { documentId } = await params;
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundError("Doküman bulunamadı.");
    if (!document.deletedAt) {
      return NextResponse.json(
        { error: "Kalıcı silme yalnızca çöp kutusundaki dokümanlar için yapılabilir." },
        { status: 400 },
      );
    }

    // Denetim kaydı, doküman satırı silindikten sonra da okunabilir kalması
    // için documentId'yi NULL bırakabilir (ON DELETE SET NULL) — bu yüzden
    // başlık anlık görüntüsü (documentTitleSnapshot) ayrıca saklanır.
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "PERMANENTLY_DELETED",
      description: "Doküman kalıcı olarak silindi.",
      ipAddress: getClientIp(req),
    });

    await prisma.document.delete({ where: { id: documentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
