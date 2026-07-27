import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { saveFile, MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { resolveFinancePermissions, assertPermission, canViewTransaction } from "@/lib/finance-permissions";

interface Params {
  params: Promise<{ transactionId: string }>;
}

/** Fiş/fatura yükleme — tür ve boyut sunucu tarafında da doğrulanır (bkz. proje talebi §12). */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
]);

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { transactionId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);

    const transaction = await prisma.financeTransaction.findFirst({
      where: { id: transactionId, deletedAt: null },
      include: { visibleUsers: true },
    });
    if (!transaction) throw new NotFoundError("Finans kaydı bulunamadı.");

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });
    const canView = canViewTransaction(transaction, session.user.id, membership.role, permissions, me?.departmentId ?? null);
    if (!canView) throw new PermissionError("Bu finans kaydına erişim yetkiniz yok.");

    const isOwner = transaction.createdById === session.user.id || transaction.personId === session.user.id;
    const canEdit = permissions.canEditAllRecords || (permissions.canEditOwnRecords && isOwner);
    assertPermission(canEdit, "Bu kayda belge ekleme yetkiniz yok.");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Dosya boyutu 25 MB'ı aşamaz." }, { status: 413 });
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Yalnızca PDF veya görsel (PNG/JPEG/WEBP/HEIC) dosyaları yüklenebilir." },
        { status: 415 },
      );
    }

    const saved = await saveFile(file);

    const attachment = await prisma.financeAttachment.create({
      data: {
        financeTransactionId: transactionId,
        fileName: saved.fileName,
        storedPath: saved.storedPath,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        uploadedById: session.user.id,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RECORD_UPDATED",
      module: "FINANCE",
      message: `Finans kaydına "${saved.fileName}" belgesi eklendi.`,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
