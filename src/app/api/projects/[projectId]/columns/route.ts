import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createColumnSchema } from "@/lib/validations";
import { requireProjectAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    await requireProjectAccess(projectId, session.user.id);

    const columns = await prisma.taskColumn.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ columns });
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
    const data = createColumnSchema.parse(body);

    const last = await prisma.taskColumn.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const column = await prisma.taskColumn.create({
      data: {
        projectId,
        name: data.name,
        order: (last?.order ?? -1) + 1,
      },
    });

    await logActivity({
      teamId: project.teamId,
      projectId,
      userId: session.user.id,
      action: "TASK_COLUMN_CREATED",
      message: `"${column.name}" sütunu eklendi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
