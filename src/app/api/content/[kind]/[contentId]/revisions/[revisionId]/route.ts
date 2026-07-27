import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveContentTarget, isRevisionCapableKind, notifyContentUsers, type ContentKind } from "@/lib/content";
import { PermissionError, NotFoundError } from "@/lib/permissions";

interface Params {
  params: Promise<{ kind: string; contentId: string; revisionId: string }>;
}

/** PATCH: bir revizyon talebini çözüldü olarak işaretler — silme yoktur (bkz. proje talebi §12). */
export async function PATCH(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId, revisionId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü revizyon desteklemiyor." }, { status: 400 });
    }
    const { fkField, membership, permissions, teamId } = await resolveContentTarget(
      typedKind,
      contentId,
      session.user.id,
    );

    const existing = await prisma.contentRevision.findUnique({ where: { id: revisionId } });
    if (!existing || (existing as unknown as Record<string, unknown>)[fkField] !== contentId) {
      throw new NotFoundError("Revizyon kaydı bulunamadı.");
    }

    const canResolve =
      membership.role === "ADMIN" ||
      permissions.canEditAllContent ||
      existing.requestedById === session.user.id ||
      existing.assignedToId === session.user.id;
    if (!canResolve) {
      throw new PermissionError("Bu revizyonu çözüldü olarak işaretleme yetkiniz yok.");
    }

    const revision = await prisma.contentRevision.update({
      where: { id: revisionId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await logActivity({
      teamId,
      userId: session.user.id,
      action: "CONTENT_REVISION_REQUESTED",
      module: "CONTENT",
      message: "Bir revizyon talebi çözüldü olarak işaretlendi.",
      ipAddress: getClientIp(_req),
    });

    if (existing.requestedById !== session.user.id) {
      await notifyContentUsers([existing.requestedById], {
        type: "CONTENT_APPROVED",
        title: "Revizyon çözüldü",
        message: "Talep ettiğiniz revizyon çözüldü olarak işaretlendi.",
        link: `/content/${kind}`,
      });
    }

    return NextResponse.json({ revision });
  } catch (error) {
    return handleApiError(error);
  }
}
