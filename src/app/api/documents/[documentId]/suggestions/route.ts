import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentSuggestionSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

const authorSelect = { id: true, name: true, email: true, image: true } as const;

/** GET: Doküman için tüm önerileri (bekleyen + karara bağlanmış) döner. */
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const suggestions = await prisma.documentSuggestion.findMany({
      where: { documentId, ...(status ? { status: status as "PENDING" | "ACCEPTED" | "REJECTED" } : {}) },
      include: {
        author: { select: authorSelect },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Öneri metaverisini kaydeder. INSERT/DELETE türleri için editör
 * (collaborative-editor.tsx) bu isteği, ilgili mark'ı Yjs belgesine
 * yazdıktan HEMEN SONRA aynı `id` ile gönderir — bkz. suggestion-mode-
 * extension.ts. FORMAT/MOVE türleri yalnızca bu tablo üzerinden, açıklama
 * metniyle (`note`) izlenir.
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
    const data = createDocumentSuggestionSchema.parse(body);

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const suggestion = await prisma.documentSuggestion.create({
      data: {
        id: data.id || undefined,
        documentId,
        authorId: session.user.id,
        type: data.type,
        anchorFrom: data.anchorFrom ?? undefined,
        anchorTo: data.anchorTo ?? undefined,
        originalText: data.originalText || undefined,
        suggestedText: data.suggestedText || undefined,
        note: data.note || undefined,
      },
      include: { author: { select: authorSelect } },
    });

    if (document.ownerId !== session.user.id) {
      await notifyDocumentUser({
        userId: document.ownerId,
        title: "Yeni bir öneri eklendi",
        message: `"${document.title}" dokümanında yeni bir değişiklik önerisi var.`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_UPDATE",
      });
    }
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanına öneri ekledi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
