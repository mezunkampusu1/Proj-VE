import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createPublicShareLinkSchema } from "@/lib/validations";
import { logDocumentAudit } from "@/lib/document-audit";
import { getClientIp } from "@/lib/activity";
import { hashPassword } from "@/lib/password";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * POST: Dış (ekip dışı, oturumsuz) bağlantı paylaşımı oluşturur/yeniler
 * (§22). Süreli ve/veya şifreli olabilir; belirtilmezse süresizdir.
 * En az EDITOR erişimi gerekir — paylaşım yönetimi, doküman paylaşım
 * API'sindeki (permissions/route.ts) aynı yetki eşiğiyle tutarlıdır.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const body = await req.json().catch(() => ({}));
    const data = createPublicShareLinkSchema.parse(body);

    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = data.expiresInHours ? new Date(Date.now() + data.expiresInHours * 3600 * 1000) : null;
    const passwordHash = data.password ? await hashPassword(data.password) : null;

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        publicShareToken: token,
        publicShareExpiresAt: expiresAt,
        publicSharePasswordHash: passwordHash,
      },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "SHARED",
      description: `Dış bağlantı paylaşımı oluşturuldu${expiresAt ? ` (süre: ${expiresAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})` : ""}${passwordHash ? ", şifreli" : ""}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ token, expiresAt, hasPassword: !!passwordHash });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Dış bağlantı paylaşımını iptal eder. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { publicShareToken: null, publicShareExpiresAt: null, publicSharePasswordHash: null },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "SHARED",
      description: "Dış bağlantı paylaşımı iptal edildi.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
