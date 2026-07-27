import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAnnouncementSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

const detailInclude = {
  university: { select: { id: true, name: true, city: true } },
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

interface Params {
  params: Promise<{ announcementId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { announcementId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: detailInclude,
    });
    if (!announcement) throw new NotFoundError("Duyuru bulunamadı.");

    return NextResponse.json({ announcement });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { announcementId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!existing) throw new NotFoundError("Duyuru bulunamadı.");
    if (existing.createdById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu duyuruyu yalnızca ekleyen kişi veya yönetici düzenleyebilir.");
    }

    const body = await req.json();
    const data = updateAnnouncementSchema.parse(body);

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        universityId: data.universityId,
        typeId: data.typeId,
        title: data.title,
        entryDate: toDateOrUndefined(data.entryDate),
        description: data.description === undefined ? undefined : data.description || null,
        sourceUrl: data.sourceUrl === undefined ? undefined : data.sourceUrl || null,
      },
      include: detailInclude,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "ANNOUNCEMENT_UPDATED",
      module: "ANNOUNCEMENTS",
      message: `"${announcement.title}" duyurusu güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { announcementId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!existing) throw new NotFoundError("Duyuru bulunamadı.");
    if (existing.createdById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu duyuruyu yalnızca ekleyen kişi veya yönetici silebilir.");
    }

    await prisma.announcement.delete({ where: { id: announcementId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "ANNOUNCEMENT_DELETED",
      module: "ANNOUNCEMENTS",
      message: `"${existing.title}" duyurusu silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
