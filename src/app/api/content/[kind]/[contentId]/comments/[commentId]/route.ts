import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { updateContentCommentSchema } from "@/lib/validations";
import { resolveContentTarget, type ContentKind } from "@/lib/content";
import { PermissionError, NotFoundError } from "@/lib/permissions";

interface Params {
  params: Promise<{ kind: string; contentId: string; commentId: string }>;
}

async function loadComment(fkField: string, contentId: string, commentId: string) {
  const comment = await prisma.contentComment.findUnique({ where: { id: commentId } });
  if (!comment || (comment as unknown as Record<string, unknown>)[fkField] !== contentId) {
    throw new NotFoundError("Yorum bulunamadı.");
  }
  return comment;
}

/** PATCH: yalnızca yorumu yazan kişi düzenleyebilir. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId, commentId } = await params;
    const { fkField } = await resolveContentTarget(kind as ContentKind, contentId, session.user.id);
    const existing = await loadComment(fkField, contentId, commentId);

    if (existing.authorId !== session.user.id) {
      throw new PermissionError("Bu yorumu yalnızca yazan kişi düzenleyebilir.");
    }

    const body = await req.json();
    const data = updateContentCommentSchema.parse(body);

    const comment = await prisma.contentComment.update({
      where: { id: commentId },
      data: { body: data.body },
      include: { author: { select: { id: true, name: true, email: true, image: true } } },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: yorumu yazan kişi VEYA ADMIN silebilir. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId, commentId } = await params;
    const { fkField, membership } = await resolveContentTarget(kind as ContentKind, contentId, session.user.id);
    const existing = await loadComment(fkField, contentId, commentId);

    if (existing.authorId !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu yorumu yalnızca yazan kişi veya admin silebilir.");
    }

    await prisma.contentComment.delete({ where: { id: commentId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
