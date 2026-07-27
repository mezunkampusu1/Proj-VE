import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnouncementTypeSchema } from "@/lib/validations";
import { requireTeamMember, requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const types = await prisma.announcementType.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ types });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // Tür listesi artık sabit/kapalıdır (bkz. görev #173 — ekip üyelerine
    // açık olan serbest tür ekleme kaldırıldı, önceden görev #43'te
    // açılmıştı). Bu uç nokta yalnızca yönetici için kalıyor; UI'da "yeni
    // tür ekle" alanı yok, ama örn. gelecekte özel bir ihtiyaç çıkarsa
    // yönetici doğrudan API üzerinden ekleyebilsin diye tamamen kaldırılmadı.
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = createAnnouncementTypeSchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.announcementType.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ type: existing }, { status: 200 });

    const type = await prisma.announcementType.create({
      data: { name: data.name.trim(), slug },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "ANNOUNCEMENT_TYPE_CREATED",
      module: "ANNOUNCEMENTS",
      message: `"${type.name}" duyuru türü eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ type }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
