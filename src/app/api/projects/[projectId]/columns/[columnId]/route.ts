import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateColumnSchema } from "@/lib/validations";
import { requireColumnAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ projectId: string; columnId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { columnId } = await params;
    const { column: existing } = await requireColumnAccess(columnId, session.user.id);

    const body = await req.json();
    const data = updateColumnSchema.parse(body);

    const column = await prisma.taskColumn.update({
      where: { id: columnId },
      data: { name: data.name, isDoneColumn: data.isDoneColumn },
    });

    await logActivity({
      teamId: existing.project.teamId,
      projectId: existing.project.id,
      userId: session.user.id,
      action: "TASK_COLUMN_UPDATED",
      message: `"${existing.name}" sütunu güncellendi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ column });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { columnId } = await params;
    const { column } = await requireColumnAccess(columnId, session.user.id);

    await prisma.taskColumn.delete({ where: { id: columnId } });

    await logActivity({
      teamId: column.project.teamId,
      projectId: column.project.id,
      userId: session.user.id,
      action: "TASK_COLUMN_DELETED",
      message: `"${column.name}" sütunu silindi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Sütunda hâlâ görev veya tekrarlayan şablon varsa FK (RESTRICT) engeller.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Bu sütunda görevler (veya tekrarlayan şablonlar) var, önce onları başka bir sütuna taşıyın." },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
