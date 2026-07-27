import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createContentCommentSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import { resolveContentTarget, notifyContentUsers, type ContentKind } from "@/lib/content";

interface Params {
  params: Promise<{ kind: string; contentId: string }>;
}

/**
 * Yorumlar — SocialContent/BlogContent/SeoWork/DailyWorkReport'un
 * DÖRDÜ için TEK paylaşımlı `ContentComment` tablosu (bkz. lib/content.ts
 * resolveContentTarget). `kind` URL segmenti hangi FK sütununun
 * kullanılacağını belirler.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const { fkField } = await resolveContentTarget(kind as ContentKind, contentId, session.user.id);

    const comments = await prisma.contentComment.findMany({
      where: { [fkField]: contentId, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        replies: {
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
            mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { kind, contentId } = await params;
    const { fkField, permissions, notifyTargets } = await resolveContentTarget(
      kind as ContentKind,
      contentId,
      session.user.id,
    );
    assertContentPermission(permissions.canComment, "Yorum yapma yetkiniz yok.");

    const body = await req.json();
    const data = createContentCommentSchema.parse(body);

    if (data.parentId) {
      const parent = await prisma.contentComment.findUnique({ where: { id: data.parentId } });
      if (!parent || (parent as Record<string, unknown>)[fkField] !== contentId) {
        return NextResponse.json({ error: "Geçersiz üst yorum." }, { status: 400 });
      }
    }

    const mentionedUserIds =
      permissions.canMentionUsers && data.mentionedUserIds
        ? Array.from(new Set(data.mentionedUserIds))
        : [];

    const comment = await prisma.contentComment.create({
      data: {
        authorId: session.user.id,
        [fkField]: contentId,
        body: data.body,
        parentId: data.parentId || undefined,
        mentions: mentionedUserIds.length > 0
          ? { create: mentionedUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      },
    });

    const mentionOnlyIds = mentionedUserIds.filter((id) => id !== session.user.id);
    if (mentionOnlyIds.length > 0) {
      await notifyContentUsers(mentionOnlyIds, {
        type: "CONTENT_MENTIONED",
        title: "Bir yorumda etiketlendiniz",
        message: "Bir içerik yorumunda etiketlendiniz.",
        link: `/content/${kind}`,
      });
    }

    const restTargets = notifyTargets.filter((id) => !mentionOnlyIds.includes(id));
    if (restTargets.length > 0) {
      await notifyContentUsers(restTargets, {
        type: "CONTENT_COMMENT",
        title: "Yeni yorum",
        message: `${session.user.name || "Bir kullanıcı"} bir içeriğe yorum yaptı.`,
        link: `/content/${kind}`,
      });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
