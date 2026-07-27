import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { readStoredFile } from "@/lib/storage";
import { resolveFinancePermissions, assertPermission, canViewTransaction } from "@/lib/finance-permissions";

interface Params {
  params: Promise<{ transactionId: string; attachmentId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { transactionId, attachmentId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canViewAttachments, "Belge görüntüleme yetkiniz yok.");

    const transaction = await prisma.financeTransaction.findFirst({
      where: { id: transactionId, deletedAt: null },
      include: { visibleUsers: true },
    });
    if (!transaction) throw new NotFoundError("Finans kaydı bulunamadı.");

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });
    const canView = canViewTransaction(transaction, session.user.id, membership.role, permissions, me?.departmentId ?? null);
    if (!canView) throw new PermissionError("Bu finans kaydına erişim yetkiniz yok.");

    const attachment = await prisma.financeAttachment.findFirst({
      where: { id: attachmentId, financeTransactionId: transactionId },
    });
    if (!attachment) throw new NotFoundError("Belge bulunamadı.");

    const buffer = await readStoredFile(attachment.storedPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Content-Length": String(attachment.fileSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
