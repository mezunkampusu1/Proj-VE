import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentVersionSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

const authorSelect = { id: true, name: true, email: true } as const;

/**
 * GET: Sürüm geçmişi — hem otomatik anlık görüntüleri (collab servisinin
 * periyodik olarak aldığı, bkz. collab-server/src/index.ts) hem de
 * kullanıcının manuel "Sürüm Kaydet" ile adlandırdığı sürümleri döner.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        isAutoSnapshot: true,
        createdAt: true,
        contentText: true,
        createdBy: { select: authorSelect },
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Kullanıcının doküman'ın O ANKİ içeriğini adlandırarak kalıcı bir
 * sürüm olarak kaydetmesi ("Sürüm Kaydet"). `documents.content`, collab
 * servisi tarafından her canlı değişiklikte güncel tutulur (bkz.
 * onStoreDocument) — bu yüzden burada doğrudan o alan kopyalanır.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = createDocumentVersionSchema.parse(body);

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        label: data.label,
        isAutoSnapshot: false,
        content: document.content ?? {},
        contentText: document.contentText,
        createdById: session.user.id,
      },
      include: { createdBy: { select: authorSelect } },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EDITED",
      field: "version",
      newValue: data.label,
      description: "Manuel sürüm kaydedildi.",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanında "${data.label}" sürümünü kaydetti.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
