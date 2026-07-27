import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createSocialContentPerformanceSchema } from "@/lib/validations";
import { assertContentPermission } from "@/lib/content-permissions";
import { requireSocialContentAccess } from "@/lib/content";

interface Params {
  params: Promise<{ contentId: string }>;
}

/**
 * Yayınlanan bir sosyal medya içeriğinin performans metriklerini kaydeder/
 * günceller (bkz. proje talebi §9/§16) — tekil `SocialContentPerformance`
 * kaydı, `upsert` ile hem ilk giriş hem sonraki güncellemeler aynı uç
 * noktadan yapılır. `canMarkPublished` yetkisi (veya genel düzenleme
 * yetkisi) gerektirir — performans girişi de bir tür "yayın sonrası"
 * işlemdir.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { contentId } = await params;
    const { content: existing, permissions, membership } = await requireSocialContentAccess(contentId, session.user.id);

    const isCreator = existing.createdById === session.user.id;
    assertContentPermission(
      permissions.canMarkPublished || permissions.canEditAllContent || (permissions.canEditOwnContent && isCreator) || membership.role === "ADMIN",
      "Performans verisi girme yetkiniz yok.",
    );

    const body = await req.json();
    const data = createSocialContentPerformanceSchema.parse(body);

    const performance = await prisma.socialContentPerformance.upsert({
      where: { socialContentId: contentId },
      create: {
        socialContentId: contentId,
        recordedById: session.user.id,
        impressions: data.impressions ?? undefined,
        reach: data.reach ?? undefined,
        likes: data.likes ?? undefined,
        comments: data.comments ?? undefined,
        shares: data.shares ?? undefined,
        saves: data.saves ?? undefined,
        linkClicks: data.linkClicks ?? undefined,
        followerGain: data.followerGain ?? undefined,
        videoWatchSeconds: data.videoWatchSeconds ?? undefined,
        engagementRate: data.engagementRate ?? undefined,
      },
      update: {
        recordedById: session.user.id,
        impressions: data.impressions ?? undefined,
        reach: data.reach ?? undefined,
        likes: data.likes ?? undefined,
        comments: data.comments ?? undefined,
        shares: data.shares ?? undefined,
        saves: data.saves ?? undefined,
        linkClicks: data.linkClicks ?? undefined,
        followerGain: data.followerGain ?? undefined,
        videoWatchSeconds: data.videoWatchSeconds ?? undefined,
        engagementRate: data.engagementRate ?? undefined,
      },
    });

    await logActivity({
      teamId: existing.teamId,
      userId: session.user.id,
      action: "CONTENT_UPDATED",
      module: "CONTENT",
      message: `"${existing.title}" içeriği için performans verisi güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ performance });
  } catch (error) {
    return handleApiError(error);
  }
}
