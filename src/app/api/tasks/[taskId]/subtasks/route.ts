import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSubtaskSchema } from "@/lib/validations";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ taskId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const body = await req.json();
    const data = createSubtaskSchema.parse(body);

    const subtask = await prisma.subTask.create({
      data: { taskId, title: data.title },
    });

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
