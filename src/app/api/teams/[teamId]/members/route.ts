import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/validations";
import { requireTeamAdmin, requireTeamMember } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/activity";

interface Params {
  params: Promise<{ teamId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;
    await requireTeamMember(teamId, session.user.id);

    const [members, invites] = await Promise.all([
      prisma.teamMember.findMany({
        where: { teamId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.teamInvite.findMany({
        where: { teamId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ members, invites });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Takıma yeni bir üye davet eder. Kullanıcı sistemde zaten kayıtlıysa
 * doğrudan takıma eklenir ve bildirim alır; değilse bekleyen bir davet
 * (TeamInvite) oluşturulur ve kayıt olduğunda kabul edilebilir.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;
    await requireTeamAdmin(teamId, session.user.id);

    const body = await req.json();
    const data = inviteMemberSchema.parse(body);

    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

    if (existingUser) {
      const alreadyMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (alreadyMember) {
        return NextResponse.json(
          { error: "Bu kullanıcı zaten takımın üyesi." },
          { status: 409 },
        );
      }

      const member = await prisma.teamMember.create({
        data: { teamId, userId: existingUser.id, role: data.role },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      await notifyUser({
        userId: existingUser.id,
        type: "TEAM_INVITED",
        title: "Yeni takıma eklendiniz",
        message: `"${team.name}" takımına eklendiniz.`,
        link: `/teams/${teamId}`,
      });

      return NextResponse.json({ member }, { status: 201 });
    }

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email: data.email,
        role: data.role,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
