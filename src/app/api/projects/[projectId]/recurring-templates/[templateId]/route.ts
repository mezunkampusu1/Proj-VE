import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRecurringTemplateSchema } from "@/lib/validations";
import { requireRecurringTemplateAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, notifyUser, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ projectId: string; templateId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { templateId } = await params;
    const { template: existing } = await requireRecurringTemplateAccess(templateId, session.user.id);

    const body = await req.json();
    const data = updateRecurringTemplateSchema.parse(body);

    // Kullanıcı talebi #11: çoklu atama — gönderildiyse eski atananlar
    // silinip yenileri yazılır (aynı işlem içinde, yarı-güncellenmiş bir
    // duruma düşmemek için $transaction ile).
    const previousAssigneeIds =
      data.assigneeIds !== undefined
        ? (
            await prisma.recurringTemplateAssignee.findMany({
              where: { templateId },
              select: { userId: true },
            })
          ).map((a) => a.userId)
        : [];
    const nextAssigneeIds = data.assigneeIds !== undefined ? Array.from(new Set(data.assigneeIds)) : undefined;

    const [template] = await prisma.$transaction([
      prisma.recurringTaskTemplate.update({
        where: { id: templateId },
        data: {
          columnId: data.columnId,
          title: data.title,
          description: data.description === undefined ? undefined : data.description,
          priority: data.priority,
          active: data.active,
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
          column: { select: { id: true, name: true } },
          assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      }),
    ]);

    await logActivity({
      teamId: existing.project.teamId,
      projectId: existing.project.id,
      userId: session.user.id,
      action: "RECURRING_TASK_UPDATED",
      message: `"${template.title}" tekrarlayan görev şablonu güncellendi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    if (nextAssigneeIds) {
      const newlyAdded = nextAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));
      for (const userId of newlyAdded) {
        if (userId === session.user.id) continue;
        await notifyUser({
          userId,
          type: "RECURRING_ASSIGNED",
          title: "Her gün tekrarlayan görev atandı",
          message: `"${template.title}" her gün tekrarlayan görevi size atandı.`,
          link: `/teams/${existing.project.teamId}/projects/${existing.project.id}`,
        });
      }
    }

    return NextResponse.json({ template: { ...template, assignees: template.assignees.map((a) => a.user) } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { templateId } = await params;
    const { template } = await requireRecurringTemplateAccess(templateId, session.user.id);

    await prisma.recurringTaskTemplate.delete({ where: { id: templateId } });

    await logActivity({
      teamId: template.project.teamId,
      projectId: template.project.id,
      userId: session.user.id,
      action: "RECURRING_TASK_DELETED",
      message: `"${template.title}" tekrarlayan görev şablonu silindi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
