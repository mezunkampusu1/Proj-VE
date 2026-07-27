import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createImportantDateTypeSchema } from "@/lib/validations";
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

    const types = await prisma.importantDateType.findMany({ orderBy: { name: "asc" } });
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
    // Duyuru türlerinde olduğu gibi tür listesi artık sabit/kapalıdır (bkz.
    // görev #173). Bu uç nokta yalnızca yönetici için kalıyor.
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = createImportantDateTypeSchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.importantDateType.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ type: existing }, { status: 200 });

    const type = await prisma.importantDateType.create({
      data: { name: data.name.trim(), slug },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DATE_TYPE_CREATED",
      module: "DATES",
      message: `"${type.name}" tarih türü eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ type }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
