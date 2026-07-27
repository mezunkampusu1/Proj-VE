import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ entryId: string }>;
}

/** POST: Yönetici, kullanıcı adına ara başlatır. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { entryId } = await params;
    const entry = await prisma.dailyFlowEntry.findUnique({
      where: { id: entryId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!entry) throw new NotFoundError("Günlük Akış kaydı bulunamadı.");
    if (entry.status !== "ACTIVE") {
      return NextResponse.json({ error: "Ara başlatmak için akışın aktif olması gerekir." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.dailyFlowBreak.create({
        data: { entryId, startedAt: new Date(), actedById: session.user.id },
      }),
      prisma.dailyFlowEntry.update({ where: { id: entryId }, data: { status: "ON_BREAK" } }),
    ]);

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_BREAK_STARTED",
      module: "DAILY_FLOW",
      message: `${entry.user.name || entry.user.email} kullanıcısı adına ara başlattı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ message: "Ara, kullanıcı adına başlatıldı." });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH: Yönetici, kullanıcının açık arasını kendi adına bitirir. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { entryId } = await params;
    const entry = await prisma.dailyFlowEntry.findUnique({
      where: { id: entryId },
      include: { breaks: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!entry) throw new NotFoundError("Günlük Akış kaydı bulunamadı.");
    if (entry.status !== "ON_BREAK") {
      return NextResponse.json({ error: "Açık bir ara bulunamadı." }, { status: 409 });
    }
    const openBreak = entry.breaks.find((b) => !b.endedAt);
    if (!openBreak) {
      return NextResponse.json({ error: "Açık bir ara bulunamadı." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.dailyFlowBreak.update({
        where: { id: openBreak.id },
        data: { endedAt: new Date(), actedById: session.user.id },
      }),
      prisma.dailyFlowEntry.update({ where: { id: entryId }, data: { status: "ACTIVE" } }),
    ]);

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_BREAK_ENDED",
      module: "DAILY_FLOW",
      message: `${entry.user.name || entry.user.email} kullanıcısı adına arayı bitirdi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ message: "Ara, kullanıcı adına bitirildi." });
  } catch (error) {
    return handleApiError(error);
  }
}
