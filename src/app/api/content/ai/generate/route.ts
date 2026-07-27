import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { generateContentAiSchema } from "@/lib/validations";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import { generateContentAi } from "@/lib/content-ai";

/**
 * POST: Claude ile içerik üretimi başlatır. Sonuç asla otomatik bir alana
 * yazılmaz veya yayınlanmaz — kullanıcıya taslak olarak döner, kabul/
 * düzenle/reddet kararı ayrı bir uç noktadan verilir (bkz. proje talebi §9,
 * `PATCH /api/content/ai/[generationId]`).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canUseAi, "Yapay zekâ özelliklerini kullanma yetkiniz yok.");

    const body = await req.json();
    const data = generateContentAiSchema.parse(body);

    const result = await generateContentAi({
      userId: session.user.id,
      actionType: data.actionType,
      input: data.input,
      socialContentId: data.socialContentId,
      blogContentId: data.blogContentId,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "AI_CONTENT_GENERATED",
      module: "CONTENT",
      message: `Yapay zekâ ile içerik üretildi (${data.actionType}).`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
