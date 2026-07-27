import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { dailyFlowNotificationPreferenceSchema } from "@/lib/validations";

/** GET: Oturum açan yöneticinin Günlük Akış bildirim tercihleri — yoksa alan bazlı varsayılanlar geçerlidir. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const preference = await prisma.dailyFlowNotificationPreference.findUnique({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ preference });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT: Yöneticinin hangi Günlük Akış olaylarında bildirim alacağını günceller. */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = dailyFlowNotificationPreferenceSchema.parse(body);

    const preference = await prisma.dailyFlowNotificationPreference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    });

    return NextResponse.json({ preference });
  } catch (error) {
    return handleApiError(error);
  }
}
