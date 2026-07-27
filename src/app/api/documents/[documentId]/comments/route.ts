import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentCommentSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";
import { extractMentionedUserIds } from "@/lib/tasks";

interface Params {
  params: Promise<{ documentId: string }>;
}

const authorSelect = { id: true, name: true, email: true, image: true } as const;

/** GET: Doküman yorumlarını (üst seviye + yanıtlar) döner. `?resolved=1|0` ile filtrelenebilir. */
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const { searchParams } = new URL(req.url);
    const resolvedParam = searchParams.get("resolved");

    const comments = await prisma.documentComment.findMany({
      where: {
        documentId,
        parentCommentId: null,
        deletedAt: null,
        ...(resolvedParam === "1" ? { resolved: true } : {}),
        ...(resolvedParam === "0" ? { resolved: false } : {}),
      },
      include: {
        author: { select: authorSelect },
        resolvedBy: { select: { id: true, name: true } },
        replies: {
          where: { deletedAt: null },
          include: { author: { select: authorSelect } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Yeni yorum veya yanıt ekler. Metinde `@[Ad](userId)` biçiminde
 * etiketleme varsa etiketlenen kullanıcılara bildirim gönderilir; ayrıca
 * dokümana erişimi OLMAYAN bir kullanıcı etiketlenirse bunu engellemek
 * yerine yanıt gövdesinde `mentionWarnings` ile geri bildirilir (§ "erişimi
 * olmayan kullanıcı etiketlenirse uyarı gösterilmeli").
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "COMMENTER");

    const body = await req.json();
    const data = createDocumentCommentSchema.parse(body);

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    if (data.parentCommentId) {
      const parent = await prisma.documentComment.findUnique({ where: { id: data.parentCommentId } });
      if (!parent || parent.documentId !== documentId) {
        return NextResponse.json({ error: "Yanıt verilen yorum bulunamadı." }, { status: 404 });
      }
    }

    const comment = await prisma.documentComment.create({
      data: {
        documentId,
        parentCommentId: data.parentCommentId || undefined,
        authorId: session.user.id,
        body: data.body,
        anchorFrom: data.anchorFrom ?? undefined,
        anchorTo: data.anchorTo ?? undefined,
        anchorText: data.anchorText || undefined,
      },
      include: { author: { select: authorSelect } },
    });

    const ip = getClientIp(req);
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "COMMENT_ADDED",
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_UPDATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanına yorum ekledi.`,
      ipAddress: ip,
    });

    // Doküman sahibine ve (yanıtsa) üst yorumun yazarına bildirim —
    // kendi yorumuna bildirim gitmez.
    const notifyTargets = new Set<string>();
    if (document.ownerId !== session.user.id) notifyTargets.add(document.ownerId);
    if (data.parentCommentId) {
      const parent = await prisma.documentComment.findUnique({ where: { id: data.parentCommentId } });
      if (parent && parent.authorId !== session.user.id) notifyTargets.add(parent.authorId);
    }
    for (const userId of notifyTargets) {
      await notifyDocumentUser({
        userId,
        title: data.parentCommentId ? "Yorumunuza yanıt geldi" : "Dokümanınıza yorum yapıldı",
        message: `"${document.title}" dokümanında yeni bir yorum var.`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_COMMENT",
      });
    }

    // @mention işleme — mevcut görev yorumu altyapısıyla aynı belirteç.
    const mentionedIds = extractMentionedUserIds(data.body).filter((id) => id !== session.user.id);
    const mentionWarnings: string[] = [];
    if (mentionedIds.length > 0) {
      const validMembers = await prisma.teamMember.findMany({
        where: { teamId: workspace.id, userId: { in: mentionedIds } },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      for (const member of validMembers) {
        const accessLevel = await requireDocumentAccess(documentId, member.userId, "VIEWER").catch(() => null);
        if (!accessLevel) {
          mentionWarnings.push(member.user.name || member.user.email || member.userId);
          continue;
        }
        await notifyDocumentUser({
          userId: member.userId,
          title: "Bir yorumda etiketlendiniz",
          message: `${session.user.name || session.user.email} sizi "${document.title}" dokümanındaki bir yorumda etiketledi.`,
          link: `/ortak-alan/${documentId}`,
          type: "DOCUMENT_MENTIONED",
        });
      }
    }

    return NextResponse.json({ comment, mentionWarnings }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
