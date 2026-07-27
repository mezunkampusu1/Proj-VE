import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { decideDocumentSuggestionSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string; suggestionId: string }>;
}

/**
 * PATCH: Öneriyi kabul/reddeder. Bu uç yalnızca VERİTABANI durumunu
 * günceller (durum/karar veren/karar zamanı) — INSERT/DELETE türü
 * önerilerde Yjs belgesindeki gerçek mark kaldırma/metin silme işlemi
 * karar veren kullanıcının AÇIK EDİTÖRÜ tarafından, bu istek başarılı
 * döndükten hemen sonra `editor.commands.acceptSuggestion/rejectSuggestion`
 * ile ayrıca tetiklenir (bkz. collaborative-editor.tsx). Reddedilen
 * öneriler spesifikasyon gereği SİLİNMEZ, geçmişte durum=REJECTED olarak
 * kalır.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, suggestionId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "EDITOR");
    if (level !== "EDITOR" && level !== "OWNER") {
      throw new PermissionError("Öneriyi kabul/reddetme yetkiniz yok.");
    }

    const suggestion = await prisma.documentSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion || suggestion.documentId !== documentId) {
      throw new NotFoundError("Öneri bulunamadı.");
    }
    if (suggestion.status !== "PENDING") {
      return NextResponse.json({ error: "Bu öneri zaten karara bağlanmış." }, { status: 409 });
    }

    const body = await req.json();
    const { decision } = decideDocumentSuggestionSchema.parse(body);

    const updated = await prisma.documentSuggestion.update({
      where: { id: suggestionId },
      data: { status: decision, decidedById: session.user.id, decidedAt: new Date() },
    });

    const document = await prisma.document.findUnique({ where: { id: documentId }, select: { title: true } });
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document?.title || "Doküman",
      actorId: session.user.id,
      action: decision === "ACCEPTED" ? "SUGGESTION_ACCEPTED" : "SUGGESTION_REJECTED",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document?.title}" dokümanındaki bir öneriyi ${decision === "ACCEPTED" ? "kabul etti" : "reddetti"}.`,
      ipAddress: getClientIp(req),
    });

    if (suggestion.authorId !== session.user.id) {
      await notifyDocumentUser({
        userId: suggestion.authorId,
        title: decision === "ACCEPTED" ? "Öneriniz kabul edildi" : "Öneriniz reddedildi",
        message: `"${document?.title}" dokümanındaki öneriniz ${decision === "ACCEPTED" ? "kabul edildi" : "reddedildi"}.`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_UPDATE",
      });
    }

    return NextResponse.json({ suggestion: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
