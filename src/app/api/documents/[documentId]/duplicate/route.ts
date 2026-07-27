import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, requireProjectAccess, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { duplicateDocumentSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";
import type { PMNode } from "@/lib/document-export";

interface Params {
  params: Promise<{ documentId: string }>;
}

const documentListInclude = {
  type: true,
  folder: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
} as const;

/** Kopyalanan içerikteki tüm `taskItem` düğümlerini (derinlemesine) döndürür. */
function collectTaskItems(node: PMNode, out: PMNode[]) {
  if (node.type === "taskItem") out.push(node);
  for (const child of node.content || []) collectTaskItems(child, out);
}

/**
 * POST: Dokümanı kopyalar (§14/§ kopyalama). Kopya, isteği yapan
 * kullanıcının SAHİBİ olduğu tamamen bağımsız yeni bir dokümandır —
 * durum her zaman DRAFT'a sıfırlanır (onay/inceleme geçmişi yeni
 * dokümana taşınmaz, bkz. §15'teki tek-aşamalı onay tasarımı ile
 * tutarlı: kopya "yeniden onaya tabi" temiz bir başlangıçtır).
 *
 * `includeTasks=true` olduğunda, kontrol listesi maddelerine bağlı
 * GÖREVLER de kopyalanır — ancak yalnızca isteği yapan kullanıcının
 * erişebildiği projeler için (erişimi olmayan bir öğe sessizce bağlantısı
 * kaldırılmış düz bir kontrol kutusuna döner). `includeTasks=false`
 * durumunda TÜM bağlantılar kaldırılır — aksi halde kopyanın kontrol
 * kutuları eski dokümanın görevlerine "sızmış" gibi görünürdü.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const original = await prisma.document.findUnique({
      where: { id: documentId },
      include: { tags: true, permissions: true },
    });
    if (!original || original.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const body = await req.json().catch(() => ({}));
    const data = duplicateDocumentSchema.parse(body);

    const clonedContent: PMNode = JSON.parse(JSON.stringify(original.content || { type: "doc", content: [] }));

    if (!data.includeTasks) {
      const items: PMNode[] = [];
      collectTaskItems(clonedContent, items);
      for (const item of items) {
        if (item.attrs) item.attrs.linkedTaskId = null;
      }
    }

    const duplicate = await prisma.document.create({
      data: {
        title: data.title?.trim() || `Kopya - ${original.title}`,
        description: original.description || undefined,
        typeId: original.typeId || undefined,
        folderId: data.folderId !== undefined ? data.folderId || undefined : original.folderId || undefined,
        teamId: workspace.id,
        projectId: original.projectId || undefined,
        ownerId: session.user.id,
        createdById: session.user.id,
        content: clonedContent as object,
        contentText: original.contentText || undefined,
        wordCount: original.wordCount,
        charCount: original.charCount,
        status: "DRAFT",
        tags: original.tags.length ? { create: original.tags.map((t) => ({ tagId: t.tagId })) } : undefined,
      },
      include: documentListInclude,
    });

    if (data.includeTasks) {
      const items: PMNode[] = [];
      collectTaskItems(clonedContent, items);
      let contentChanged = false;

      for (const item of items) {
        const oldTaskId = item.attrs?.linkedTaskId as string | null | undefined;
        if (!oldTaskId) continue;

        const oldTask = await prisma.task.findUnique({
          where: { id: oldTaskId },
          include: { assignees: { select: { userId: true } } },
        });
        if (!oldTask) {
          if (item.attrs) item.attrs.linkedTaskId = null;
          contentChanged = true;
          continue;
        }

        const hasAccess = await requireProjectAccess(oldTask.projectId, session.user.id).catch(() => null);
        if (!hasAccess) {
          if (item.attrs) item.attrs.linkedTaskId = null;
          contentChanged = true;
          continue;
        }

        const newTask = await prisma.task.create({
          data: {
            projectId: oldTask.projectId,
            columnId: oldTask.columnId,
            title: oldTask.title,
            creatorId: session.user.id,
            dueDate: oldTask.dueDate || undefined,
            sourceDocumentId: duplicate.id,
            documentBlockId: (item.attrs?.documentBlockId as string) || undefined,
            assignees:
              oldTask.assignees.length > 0
                ? { create: oldTask.assignees.map((a) => ({ userId: a.userId })) }
                : undefined,
          },
        });
        if (item.attrs) item.attrs.linkedTaskId = newTask.id;
        contentChanged = true;
      }

      if (contentChanged) {
        await prisma.document.update({ where: { id: duplicate.id }, data: { content: clonedContent as object } });
      }
    }

    if (data.includeComments) {
      const comments = await prisma.documentComment.findMany({
        where: { documentId, deletedAt: null, parentCommentId: null },
        include: { replies: { where: { deletedAt: null } } },
        orderBy: { createdAt: "asc" },
      });
      for (const comment of comments) {
        const newParent = await prisma.documentComment.create({
          data: {
            documentId: duplicate.id,
            authorId: comment.authorId,
            body: comment.body,
            anchorFrom: comment.anchorFrom,
            anchorTo: comment.anchorTo,
            anchorText: comment.anchorText,
            resolved: comment.resolved,
            resolvedById: comment.resolvedById || undefined,
            resolvedAt: comment.resolvedAt || undefined,
          },
        });
        for (const reply of comment.replies) {
          await prisma.documentComment.create({
            data: {
              documentId: duplicate.id,
              parentCommentId: newParent.id,
              authorId: reply.authorId,
              body: reply.body,
            },
          });
        }
      }
    }

    if (data.includePermissions) {
      for (const perm of original.permissions) {
        await prisma.documentPermission.create({
          data: {
            documentId: duplicate.id,
            subjectType: perm.subjectType,
            subjectUserId: perm.subjectUserId || undefined,
            subjectTeamId: perm.subjectTeamId || undefined,
            subjectRole: perm.subjectRole || undefined,
            level: perm.level,
            grantedById: session.user.id,
          },
        });
      }
    }

    const ip = getClientIp(req);
    await logDocumentAudit({
      documentId: duplicate.id,
      documentTitleSnapshot: duplicate.title,
      actorId: session.user.id,
      action: "CREATED",
      description: `"${original.title}" dokümanından kopyalandı.`,
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_CREATED",
      module: "DOCUMENTS",
      message: `"${original.title}" dokümanını kopyaladı.`,
      ipAddress: ip,
    });

    return NextResponse.json({ document: duplicate }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
