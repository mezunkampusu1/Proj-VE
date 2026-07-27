import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, requireProjectAccess, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentTaskSchema } from "@/lib/validations";
import { logActivity, getClientIp, notifyUser } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

interface Params {
  params: Promise<{ documentId: string; commentId: string }>;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * POST: Bir yorumdan doğrudan görev oluşturur (§ "yorumdan görev atama").
 * Görev, MEVCUT görev/Kanban modülüne (Task/Project/TaskColumn) yazılır —
 * yeni bir görev sistemi kurulmaz. Oluşan görev `sourceDocumentCommentId`
 * ve `sourceDocumentId` ile yoruma/dokümana geri bağlanır.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, commentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "COMMENTER");

    const comment = await prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.documentId !== documentId || comment.deletedAt) {
      throw new NotFoundError("Yorum bulunamadı.");
    }

    const body = await req.json();
    const data = createDocumentTaskSchema.parse(body);

    const { project } = await requireProjectAccess(data.projectId, session.user.id);

    let columnId = data.columnId;
    if (!columnId) {
      const firstColumn = await prisma.taskColumn.findFirst({
        where: { projectId: data.projectId },
        orderBy: { order: "asc" },
      });
      if (!firstColumn) {
        return NextResponse.json({ error: "Seçilen projede henüz bir sütun yok." }, { status: 400 });
      }
      columnId = firstColumn.id;
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });

    // Task.kind varsayılanı Prisma şemasında DATED'dir ve DATED görevler
    // yalnızca kendi scheduledDate'iyle eşleşen günün panosunda görünür
    // (bkz. /api/projects/[projectId]/tasks GET). Burada kind/scheduledDate
    // ATANMAZSA oluşan görev scheduledDate=null ile kalır ve hiçbir günün
    // panosunda EŞLEŞMEZ — görev veritabanında gerçekten oluşur ama kullanıcı
    // hiçbir yerde GÖREMEZ (bkz. görev #192: "oluşturuldu diyor ama görev
    // oluşmuyor" şikayeti). Sabit (FIXED) projelerde /api/projects/.../tasks
    // POST ile AYNI davranış uygulanır: kind zorla FIXED, scheduledDate yok;
    // tarih bazlı (DATED) projelerde varsayılan olarak BUGÜNÜN panosuna
    // eklenir.
    const kind = project.kind === "FIXED" ? "FIXED" : "DATED";
    const scheduledDate = kind === "FIXED" ? undefined : toDateOrUndefined(todayIso());

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        columnId,
        title: data.title,
        kind,
        scheduledDate,
        assignees: data.assigneeId ? { create: [{ userId: data.assigneeId }] } : undefined,
        creatorId: session.user.id,
        dueDate: toDateOrUndefined(data.dueDate ?? undefined),
        sourceDocumentId: documentId,
        sourceDocumentCommentId: commentId,
      },
    });

    await logActivity({
      teamId: project.teamId,
      projectId: project.id,
      taskId: task.id,
      userId: session.user.id,
      action: "TASK_CREATED",
      module: "TASKS",
      message: `"${document?.title}" dokümanındaki bir yorumdan görev oluşturdu.`,
      ipAddress: getClientIp(req),
    });

    if (data.assigneeId && data.assigneeId !== session.user.id) {
      await notifyUser({
        userId: data.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Yeni görev atandı",
        message: `"${task.title}" görevi size atandı (bir Ortak Alan yorumundan oluşturuldu).`,
        link: `/teams/${project.teamId}/projects/${project.id}`,
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
