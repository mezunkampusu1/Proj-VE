import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ token: string }>;
}

/** Davet linkine tıklayan (ve giriş yapmış) kullanıcı takıma katılır. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { token } = await params;

    const invite = await prisma.teamInvite.findUnique({ where: { token } });
    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Davet geçersiz veya süresi dolmuş." },
        { status: 410 },
      );
    }

    if (invite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "Bu davet başka bir e-posta adresi için gönderilmiş." },
        { status: 403 },
      );
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: session.user.id } },
    });

    if (!existing) {
      await prisma.teamMember.create({
        data: { teamId: invite.teamId, userId: session.user.id, role: invite.role },
      });
      await logActivity({
        teamId: invite.teamId,
        userId: session.user.id,
        action: "MEMBER_JOINED",
        message: `${session.user.name ?? session.user.email} takıma katıldı.`,
        module: "TEAM",
        ipAddress: getClientIp(req),
      });
    }

    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });

    return NextResponse.json({ teamId: invite.teamId });
  } catch (error) {
    return handleApiError(error);
  }
}
