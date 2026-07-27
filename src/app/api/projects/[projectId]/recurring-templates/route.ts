import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRecurringTemplateSchema } from "@/lib/validations";
import { requireProjectAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, notifyUser, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    await requireProjectAccess(projectId, session.user.id);

    const templates = await prisma.recurringTaskTemplate.findMany({
      where: { projectId },
      include: {
        column: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Kullanıcı talebi #11: çoklu atama — istemciye join tablosunu düz
    // `assignees: User[]` şeklinde ver (bkz. tasks/route.ts flattenTask).
    return NextResponse.json({
      templates: templates.map(({ assignees, ...t }) => ({
        ...t,
        assignees: assignees.map((a) => a.user),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, session.user.id);

    const body = await req.json();
    const data = createRecurringTemplateSchema.parse(body);
    const assigneeIds = Array.from(new Set(data.assigneeIds ?? []));

    const template = await prisma.recurringTaskTemplate.create({
      data: {
        projectId,
        columnId: data.columnId,
        title: data.title,
        description: data.description ?? undefined,
        priority: data.priority ?? "MEDIUM",
        createdById: session.user.id,
        assignees: assigneeIds.length > 0 ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
      },
      include: {
        column: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    await logActivity({
      teamId: project.teamId,
      projectId,
      userId: session.user.id,
      action: "RECURRING_TASK_CREATED",
      message: `"${template.title}" her gün tekrarlayan görev olarak eklendi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    for (const userId of assigneeIds) {
      if (userId === session.user.id) continue;
      await notifyUser({
        userId,
        type: "RECURRING_ASSIGNED",
        title: "Her gün tekrarlayan görev atandı",
        message: `"${template.title}" her gün tekrarlayan görevi size atandı.`,
        link: `/teams/${project.teamId}/projects/${projectId}`,
      });
    }

    return NextResponse.json(
      { template: { ...template, assignees: template.assignees.map((a) => a.user) } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
