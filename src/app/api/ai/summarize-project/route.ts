import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { summarizeProject } from "@/lib/ai";

const schema = z.object({ projectId: z.string() });

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const { projectId } = schema.parse(body);

    await requireProjectAccess(projectId, session.user.id);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            assignees: { include: { user: { select: { name: true } } } },
            column: { select: { name: true } },
          },
        },
      },
    });

    const summary = await summarizeProject(
      project.name,
      project.tasks.map((t) => ({
        title: t.title,
        status: t.column.name,
        priority: t.priority,
        assigneeName: t.assignees.map((a) => a.user.name).filter(Boolean).join(", ") || undefined,
        dueDate: t.dueDate,
      })),
    );

    return NextResponse.json({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
