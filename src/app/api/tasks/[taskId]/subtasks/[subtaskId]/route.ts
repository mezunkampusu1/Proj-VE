import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ taskId: string; subtaskId: string }>;
}

const patchSchema = z.object({ done: z.boolean().optional(), title: z.string().min(1).max(200).optional() });

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, subtaskId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const body = await req.json();
    const data = patchSchema.parse(body);

    const subtask = await prisma.subTask.update({
      where: { id: subtaskId, taskId },
      data,
    });

    return NextResponse.json({ subtask });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, subtaskId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    await prisma.subTask.delete({ where: { id: subtaskId, taskId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
