import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { documentNotificationPreferenceSchema } from "@/lib/validations";

/** GET: Oturum açan kullanıcının Ortak Alan bildirim tercihleri — satır yoksa varsayılanlar (hepsi açık) geçerlidir. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const preference = await prisma.documentNotificationPreference.findUnique({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ preference });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT: Kullanıcının hangi Ortak Alan olaylarında bildirim alacağını günceller. Herhangi bir üye kendi tercihini değiştirebilir. */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = documentNotificationPreferenceSchema.parse(body);

    const preference = await prisma.documentNotificationPreference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    });

    return NextResponse.json({ preference });
  } catch (error) {
    return handleApiError(error);
  }
}
