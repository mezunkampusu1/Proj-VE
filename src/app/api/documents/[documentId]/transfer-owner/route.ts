import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

const transferOwnerSchema = z.object({ newOwnerId: z.string() });

/**
 * POST: Doküman sahipliğini başka bir kullanıcıya devreder. Yalnızca
 * yöneticiler kullanabilir (admin panel yetkisi, §21).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { documentId } = await params;
    const { newOwnerId } = transferOwnerSchema.parse(await req.json());

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const targetMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: workspace.id, userId: newOwnerId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Seçilen kullanıcı bu ekibin üyesi değil." }, { status: 400 });
    }

    const oldOwnerId = document.ownerId;
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { ownerId: newOwnerId },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: updated.title,
      actorId: session.user.id,
      action: "OWNER_CHANGED",
      oldValue: oldOwnerId,
      newValue: newOwnerId,
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${updated.title}" dokümanının sahipliğini devretti.`,
      ipAddress: getClientIp(req),
    });
    await notifyDocumentUser({
      userId: newOwnerId,
      title: "Doküman sahipliği size devredildi",
      message: `"${updated.title}" dokümanının sahibi oldunuz.`,
      link: `/ortak-alan/${documentId}`,
      type: "DOCUMENT_SHARED",
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
