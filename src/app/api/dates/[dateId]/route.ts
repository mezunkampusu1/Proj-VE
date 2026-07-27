import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateImportantDateSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { toDateOrNull } from "@/lib/dates";

const detailInclude = {
  university: { select: { id: true, name: true, city: true } },
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

interface Params {
  params: Promise<{ dateId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { dateId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const date = await prisma.importantDate.findUnique({
      where: { id: dateId },
      include: detailInclude,
    });
    if (!date) throw new NotFoundError("Tarih bulunamadı.");

    return NextResponse.json({ date });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { dateId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.importantDate.findUnique({ where: { id: dateId } });
    if (!existing) throw new NotFoundError("Tarih bulunamadı.");
    if (existing.createdById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu kaydı yalnızca ekleyen kişi veya yönetici düzenleyebilir.");
    }

    const body = await req.json();
    const data = updateImportantDateSchema.parse(body);

    const date = await prisma.importantDate.update({
      where: { id: dateId },
      data: {
        universityId: data.universityId,
        typeId: data.typeId,
        title: data.title,
        entryDate: toDateOrNull(data.entryDate) ?? undefined,
        // Bitiş tarihi artık opsiyonel: boş bırakılırsa null'a çekilerek
        // "henüz belirlenmedi" durumuna geri döndürülebilir.
        date: toDateOrNull(data.date),
        description: data.description === undefined ? undefined : data.description || null,
      },
      include: detailInclude,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DATE_UPDATED",
      module: "DATES",
      message: `"${date.title}" tarihi güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ date });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { dateId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.importantDate.findUnique({ where: { id: dateId } });
    if (!existing) throw new NotFoundError("Tarih bulunamadı.");
    if (existing.createdById !== session.user.id && membership.role !== "ADMIN") {
      throw new PermissionError("Bu kaydı yalnızca ekleyen kişi veya yönetici silebilir.");
    }

    await prisma.importantDate.delete({ where: { id: dateId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DATE_DELETED",
      module: "DATES",
      message: `"${existing.title}" tarihi silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
