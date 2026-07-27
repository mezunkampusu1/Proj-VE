import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireTeamMember, projectVisibilityWhere } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ teamId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;

    const membership = await requireTeamMember(teamId, session.user.id);

    // Kullanıcı talebi #6 (netleştirilmiş): aynı görünürlük kuralı —
    // bkz. lib/permissions.ts, projectVisibilityWhere.
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { joinedAt: "asc" },
        },
        projects: {
          where: projectVisibilityWhere(membership.role, session.user.id),
          include: { _count: { select: { tasks: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ team });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;

    await requireTeamAdmin(teamId, session.user.id);
    await prisma.team.delete({ where: { id: teamId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
