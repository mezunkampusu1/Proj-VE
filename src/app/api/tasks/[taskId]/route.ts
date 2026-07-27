import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTaskSchema } from "@/lib/validations";
import { requireTaskAccess, PermissionError } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, notifyUser, getClientIp } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

interface Params {
  params: Promise<{ taskId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        column: { select: { id: true, name: true, isDoneColumn: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        creator: { select: { id: true, name: true, email: true, image: true } },
        subtasks: { orderBy: { createdAt: "asc" } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
        tags: { include: { tag: true } },
        attachments: {
          include: { uploadedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      task: {
        ...task,
        assignees: task.assignees.map((a) => a.user),
        tags: task.tags.map((t) => t.tag),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    const { task: existing } = await requireTaskAccess(taskId, session.user.id);

    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    // Sütun gerçekten değişiyorsa, hedef sütun "Tamamlandı" (isDoneColumn)
    // ise completedAt otomatik doldurulur; done olmayan bir sütuna geri
    // taşınıyorsa temizlenir. Sütun değişmiyorsa completedAt'e dokunulmaz.
    let completedAt: Date | null | undefined = undefined;
    if (data.columnId && data.columnId !== existing.columnId) {
      const targetColumn = await prisma.taskColumn.findUnique({
        where: { id: data.columnId },
        select: { isDoneColumn: true },
      });
      completedAt = targetColumn?.isDoneColumn ? new Date() : null;
    }

    // Görev #196: çoklu atama. assigneeIds gönderilmediyse mevcut atama
    // listesine dokunulmaz; gönderildiyse (boş dizi dahil) tüm liste bu
    // değerle DEĞİŞTİRİLİR — en basit ve öngörülebilir semantik ("bu artık
    // atanan listesi") bu, tekil ekle/çıkar uç noktalarına göre.
    let previousAssigneeIds: string[] = [];
    let nextAssigneeIds: string[] | undefined;
    if (data.assigneeIds !== undefined) {
      const previous = await prisma.taskAssignee.findMany({
        where: { taskId },
        select: { userId: true },
      });
      previousAssigneeIds = previous.map((p) => p.userId);
      nextAssigneeIds = Array.from(new Set(data.assigneeIds));
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description ?? undefined,
        // Görev #318: descriptionJson gönderilmediyse dokunulmaz; null
        // gönderilirse (düzenleyip düz metne dönme durumu) temizlenir. Prisma,
        // opsiyonel (nullable) bir Json sütununu gerçek SQL NULL yapmak için
        // düz `null` değil `Prisma.DbNull` sentinel'ini bekler — `Prisma.JsonNull`
        // yalnızca zorunlu Json alanlarında "sütun JSON null içeriyor" anlamına
        // gelir, burada uygun olan DbNull'dur (bkz. Prisma JSON null dokümanı).
        descriptionJson:
          data.descriptionJson === undefined
            ? undefined
            : data.descriptionJson === null
              ? Prisma.DbNull
              : (data.descriptionJson as Prisma.InputJsonValue),
        columnId: data.columnId,
        priority: data.priority,
        scheduledDate: toDateOrUndefined(data.scheduledDate),
        dueDate:
          data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
        position: data.position,
        completedAt,
        ...(nextAssigneeIds !== undefined
          ? {
              assignees: {
                deleteMany: {},
                create: nextAssigneeIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      include: {
        column: { select: { id: true, name: true, isDoneColumn: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        subtasks: true,
      },
    });

    const teamId = existing.project.teamId;
    const projectId = existing.project.id;

    if (data.columnId && data.columnId !== existing.columnId) {
      await logActivity({
        teamId,
        projectId,
        taskId,
        userId: session.user.id,
        action: "TASK_STATUS_CHANGED",
        message: `"${task.title}" görevi "${task.column.name}" sütununa taşındı.`,
        module: "TASKS",
        ipAddress: getClientIp(req),
      });
    } else {
      await logActivity({
        teamId,
        projectId,
        taskId,
        userId: session.user.id,
        action: "TASK_UPDATED",
        message: `"${task.title}" görevi güncellendi.`,
        module: "TASKS",
        ipAddress: getClientIp(req),
      });
    }

    if (nextAssigneeIds !== undefined) {
      const newlyAdded = nextAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));
      for (const userId of newlyAdded) {
        if (userId === session.user.id) continue;
        await logActivity({
          teamId,
          projectId,
          taskId,
          userId: session.user.id,
          action: "TASK_ASSIGNED",
          message: `"${task.title}" görevi bir üyeye atandı.`,
          module: "TASKS",
          ipAddress: getClientIp(req),
        });
        await notifyUser({
          userId,
          type: "TASK_ASSIGNED",
          title: "Görev atandı",
          message: `"${task.title}" görevi size atandı.`,
          link: `/teams/${teamId}/projects/${projectId}`,
        });
      }
    }

    return NextResponse.json({ task: { ...task, assignees: task.assignees.map((a) => a.user) } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    const { task, membership } = await requireTaskAccess(taskId, session.user.id);

    // Kullanıcı talebi #14: görevi yalnızca oluşturan kişi veya takım
    // yöneticisi silebilir — diğer üyeler (atanmış olsalar bile) silemez.
    if (task.creatorId !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu görevi yalnızca oluşturan kişi veya yönetici silebilir.");
    }

    await prisma.task.delete({ where: { id: taskId } });

    await logActivity({
      teamId: task.project.teamId,
      projectId: task.project.id,
      userId: session.user.id,
      action: "TASK_DELETED",
      message: `"${task.title}" görevi silindi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
