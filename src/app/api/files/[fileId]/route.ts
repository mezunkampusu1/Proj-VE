import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamMembership } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity, getClientIp } from "@/lib/activity";
import { NotFoundError, PermissionError } from "@/lib/permissions";

interface Params {
  params: Promise<{ fileId: string }>;
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { fileId } = await params;

    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await getTeamMembership(workspace.id, session.user.id);
    if (!membership) throw new PermissionError("Bu takıma erişim yetkiniz yok.");

    const file = await prisma.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundError("Dosya bulunamadı.");

    const canDelete = membership.role === "ADMIN" || file.uploadedById === session.user.id;
    if (!canDelete) {
      throw new PermissionError("Bu dosyayı silme yetkiniz yok.");
    }

    await prisma.fileUpload.delete({ where: { id: fileId } });
    if (file.storedPath) {
      await deleteStoredFile(file.storedPath);
    }

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FILE_DELETED",
      module: "FILES",
      message: `"${file.title || file.fileName || file.externalUrl}" dosyası silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
