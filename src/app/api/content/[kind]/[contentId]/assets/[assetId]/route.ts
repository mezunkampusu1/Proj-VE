import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveContentTarget, isRevisionCapableKind, type ContentKind } from "@/lib/content";
import { NotFoundError, PermissionError } from "@/lib/permissions";

interface Params {
  params: Promise<{ kind: string; contentId: string; assetId: string }>;
}

/** DELETE: bir dosyayı içerikten ayırır (dosyanın kendisi silinmez, yalnızca bağlantı kaldırılır). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId, assetId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü dosya bağlamayı desteklemiyor." }, { status: 400 });
    }
    const { fkField, permissions, membership, teamId } = await resolveContentTarget(
      typedKind,
      contentId,
      session.user.id,
    );

    const existing = await prisma.contentAsset.findUnique({ where: { id: assetId } });
    if (!existing || (existing as unknown as Record<string, unknown>)[fkField] !== contentId) {
      throw new NotFoundError("Dosya bağlantısı bulunamadı.");
    }

    const canDelete =
      membership.role === "ADMIN" || permissions.canDeleteFiles || existing.addedById === session.user.id;
    if (!canDelete) {
      throw new PermissionError("Bu dosyayı kaldırma yetkiniz yok.");
    }

    await prisma.contentAsset.delete({ where: { id: assetId } });

    await logActivity({
      teamId,
      userId: session.user.id,
      action: "CONTENT_ASSET_REMOVED",
      module: "CONTENT",
      message: "Bir içerikten dosya bağlantısı kaldırıldı.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
