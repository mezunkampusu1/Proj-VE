import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

const bulkApplySchema = z.object({ sourceUserId: z.string().min(1) });

/**
 * POST: Bir kullanıcı için tanımlanmış ara hakkı/çalışma düzenini, takımdaki
 * TÜM üyelere (kaynak kullanıcı dahil) aynen kopyalar — "kişiye özgü
 * tanımladığım gibi genele de yapmam gerekiyor" talebinin toplu uygulama
 * kısmı (bkz. görev #169). Takım varsayılanından farklıdır: bu, her üye
 * için ayrı bir DailyFlowUserSetting satırı yaratır/günceller, dolayısıyla
 * sonradan tek tek özelleştirilebilir kalır.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const { sourceUserId } = bulkApplySchema.parse(body);

    const source = await prisma.dailyFlowUserSetting.findUnique({ where: { userId: sourceUserId } });
    if (!source) {
      throw new NotFoundError("Kaynak kullanıcı için tanımlı bir ara hakkı ayarı yok.");
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId: workspace.id },
      select: { userId: true },
    });

    const fields = {
      maxBreakCount: source.maxBreakCount,
      maxBreakMinutes: source.maxBreakMinutes,
      maxTotalBreakMinutes: source.maxTotalBreakMinutes,
      standardStartMinute: source.standardStartMinute,
      standardEndMinute: source.standardEndMinute,
    };

    await prisma.$transaction(
      members.map((m) =>
        prisma.dailyFlowUserSetting.upsert({
          where: { userId: m.userId },
          create: { userId: m.userId, ...fields, updatedById: session.user.id },
          update: { ...fields, updatedById: session.user.id },
        }),
      ),
    );

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DAILY_FLOW_SETTING_UPDATED",
      module: "DAILY_FLOW",
      message: `Bir kullanıcının ara hakkı ayarlarını takımın tamamına (${members.length} üye) uyguladı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ appliedCount: members.length });
  } catch (error) {
    return handleApiError(error);
  }
}
