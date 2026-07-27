import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

/**
 * POST: Yanlışlıkla tamamlanmış bir günü yeniden açar — kayıt tekrar ACTIVE
 * olur, kullanıcı kaldığı yerden devam edebilir. Eski toplamlar silinmez,
 * yalnızca kayıt tekrar tamamlanana kadar göz ardı edilir (bkz.
 * computeDurations: yalnızca status COMPLETED iken önbelleklenmiş toplamlar
 * kullanılır).
 */
export async function POST(req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { entryId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    const entry = await prisma.dailyFlowEntry.findUnique({
      where: { id: entryId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!entry) throw new NotFoundError("Günlük Akış kaydı bulunamadı.");
    if (entry.status !== "COMPLETED") {
      return NextResponse.json({ error: "Yalnızca tamamlanmış bir gün yeniden açılabilir." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.dailyFlowEntry.update({
        where: { id: entryId },
        data: {
          status: "ACTIVE",
          completedAt: null,
          reopenedById: session.user.id,
          reopenedAt: new Date(),
        },
      });
      await tx.dailyFlowEdit.create({
        data: {
          entryId,
          editedById: session.user.id,
          field: "status",
          oldValue: "COMPLETED",
          newValue: "ACTIVE",
          reason: reason ?? "Gün yeniden açıldı.",
        },
      });
      return result;
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_REOPENED",
      module: "DAILY_FLOW",
      message: `${entry.user.name || entry.user.email} kullanıcısının günü yeniden açtı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
