import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createContentRevisionSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import { resolveContentTarget, isRevisionCapableKind, notifyContentUsers, type ContentKind } from "@/lib/content";

interface Params {
  params: Promise<{ kind: string; contentId: string }>;
}

/**
 * Revizyon geçmişi — yalnızca 4 içerik türünde vardır (`DailyWorkReport`
 * hariç, bkz. lib/content.ts isRevisionCapableKind). Kayıtlar ASLA silinmez
 * (bkz. proje talebi §12) — yalnızca `status: RESOLVED` olarak işaretlenir.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü revizyon desteklemiyor." }, { status: 400 });
    }
    const { fkField } = await resolveContentTarget(typedKind, contentId, session.user.id);

    const revisions = await prisma.contentRevision.findMany({
      where: { [fkField]: contentId },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ revisions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const typedKind = kind as ContentKind;
    if (!isRevisionCapableKind(typedKind)) {
      return NextResponse.json({ error: "Bu içerik türü revizyon desteklemiyor." }, { status: 400 });
    }
    const { fkField, permissions, teamId, notifyTargets } = await resolveContentTarget(
      typedKind,
      contentId,
      session.user.id,
    );
    assertContentPermission(permissions.canRequestRevision, "Revizyon talep etme yetkiniz yok.");

    const body = await req.json();
    const data = createContentRevisionSchema.parse(body);

    const revision = await prisma.contentRevision.create({
      data: {
        requestedById: session.user.id,
        assignedToId: data.assignedToId || undefined,
        [fkField]: contentId,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
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
      message: "Bir içerik için revizyon talep edildi.",
      ipAddress: getClientIp(req),
    });

    const targets = data.assignedToId
      ? [data.assignedToId].filter((id) => id !== session.user.id)
      : notifyTargets;
    if (targets.length > 0) {
      await notifyContentUsers(targets, {
        type: "CONTENT_REVISION_REQUESTED",
        title: "Revizyon talep edildi",
        message: `${session.user.name || "Bir kullanıcı"} bir içerik için revizyon talep etti.`,
        link: `/content/${kind}`,
      });
    }

    return NextResponse.json({ revision }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
