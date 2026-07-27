import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAtlasProgramSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { updateAtlasProgramWithLog, atlasProgramDetailInclude } from "@/lib/atlas";
import { toDateOrUndefined } from "@/lib/dates";

interface Params {
  params: Promise<{ programId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { programId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const program = await prisma.atlasProgram.findUnique({
      where: { id: programId },
      include: {
        ...atlasProgramDetailInclude,
        changeLogs: {
          include: { changedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { changedAt: "desc" },
          take: 50,
        },
      },
    });
    if (!program) throw new NotFoundError("Program bulunamadı.");

    return NextResponse.json({ program });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { programId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.atlasProgram.findUnique({ where: { id: programId } });
    if (!existing) throw new NotFoundError("Program bulunamadı.");
    if (existing.createdById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu programı yalnızca ekleyen kişi veya yönetici düzenleyebilir.");
    }

    const body = await req.json();
    const data = updateAtlasProgramSchema.parse(body);

    const program = await updateAtlasProgramWithLog(
      programId,
      { ...data, entryDate: toDateOrUndefined(data.entryDate) },
      session.user.id,
    );

    const action = data.isActive === false ? "ATLAS_PROGRAM_REMOVED" : "ATLAS_PROGRAM_UPDATED";
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action,
      module: "ATLAS",
      message: `"${program.name}" programı ${data.isActive === false ? "pasifleştirildi" : "güncellendi"}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ program });
  } catch (error) {
    return handleApiError(error);
  }
}
