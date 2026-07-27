import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnouncementSchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

const listInclude = {
  university: { select: { id: true, name: true, city: true } },
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
} as const;

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get("universityId") || undefined;
    const typeId = searchParams.get("typeId") || undefined;
    const q = searchParams.get("q")?.trim();
    const entryDate = searchParams.get("entryDate") || undefined;
    const days = searchParams.get("days") ? Number(searchParams.get("days")) : undefined;

    let entryDateFilter: { gte?: Date; equals?: Date } | undefined;
    if (entryDate) {
      entryDateFilter = { equals: toDateOrUndefined(entryDate) };
    } else if (days) {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setUTCDate(since.getUTCDate() - (days - 1));
      entryDateFilter = { gte: since };
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        universityId,
        typeId,
        entryDate: entryDateFilter,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: listInclude,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = createAnnouncementSchema.parse(body);

    const announcement = await prisma.announcement.create({
      data: {
        universityId: data.universityId,
        typeId: data.typeId,
        title: data.title,
        entryDate: toDateOrUndefined(data.entryDate)!,
        description: data.description || undefined,
        sourceUrl: data.sourceUrl || undefined,
        createdById: session.user.id,
      },
      include: listInclude,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "ANNOUNCEMENT_CREATED",
      module: "ANNOUNCEMENTS",
      message: `"${announcement.title}" duyurusu eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
