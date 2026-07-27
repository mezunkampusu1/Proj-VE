import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateMemberRoleSchema } from "@/lib/validations";
import { requireTeamAdmin, PermissionError } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ teamId: string; memberId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId, memberId } = await params;
    await requireTeamAdmin(teamId, session.user.id);

    const body = await req.json();
    const data = updateMemberRoleSchema.parse(body);

    const member = await prisma.teamMember.update({
      where: { id: memberId, teamId },
      data: { role: data.role },
    });

    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId, memberId } = await params;
    await requireTeamAdmin(teamId, session.user.id);

    const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (member?.userId === session.user.id) {
      const adminCount = await prisma.teamMember.count({
        where: { teamId, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        throw new PermissionError(
          "Takımdaki son yöneticiyi çıkaramazsınız.",
        );
      }
    }

    await prisma.teamMember.delete({ where: { id: memberId, teamId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
