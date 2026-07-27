import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, requireProjectAccess } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentTaskSchema } from "@/lib/validations";
import { logActivity, getClientIp, notifyUser } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

interface Params {
  params: Promise<{ documentId: string }>;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * POST: Doküman gövdesindeki bir kontrol listesi maddesini MEVCUT görev
 * modülünde (Task/Project/TaskColumn) bir göreve dönüştürür — §7. Yeni
 * bir görev sistemi kurulmaz; bkz. comments/[commentId]/create-task
 * route'undaki aynı desen (yorumdan görev oluşturma).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = createDocumentTaskSchema.parse(body);
    if (!data.documentBlockId) {
      return NextResponse.json({ error: "documentBlockId gerekli." }, { status: 400 });
    }

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

    // Task.kind varsayılanı DATED'dir; kind/scheduledDate atanmazsa görev
    // scheduledDate=null ile kalır ve HİÇBİR günün panosunda görünmez —
    // veritabanında gerçekten oluşur ama kullanıcı hiçbir yerde göremez
    // (bkz. görev #192, aynı kök neden create-task/route.ts'te de vardı).
    // /api/projects/[projectId]/tasks POST'taki davranışla birebir aynı:
    // Sabit (FIXED) projede kind zorla FIXED, tarih bazlı (DATED) projede
    // varsayılan olarak bugünün panosuna eklenir.
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
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        sourceDocumentId: documentId,
        documentBlockId: data.documentBlockId,
      },
    });

    await logActivity({
      teamId: project.teamId,
      projectId: project.id,
      taskId: task.id,
      userId: session.user.id,
      action: "TASK_CREATED",
      module: "TASKS",
      message: `"${document?.title}" dokümanındaki bir kontrol listesi maddesinden görev oluşturdu.`,
      ipAddress: getClientIp(req),
    });

    if (data.assigneeId && data.assigneeId !== session.user.id) {
      await notifyUser({
        userId: data.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Yeni görev atandı",
        message: `"${task.title}" görevi size atandı (bir Ortak Alan kontrol listesinden oluşturuldu).`,
        link: `/teams/${project.teamId}/projects/${project.id}`,
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
