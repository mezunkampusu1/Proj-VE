import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { decideContentAiGenerationSchema } from "@/lib/validations";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import { decideContentAiGeneration } from "@/lib/content-ai";
import { NotFoundError, PermissionError } from "@/lib/permissions";

interface Params {
  params: Promise<{ generationId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { generationId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);

    const generation = await prisma.aiGeneration.findUnique({
      where: { id: generationId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
    if (!generation) {
      throw new NotFoundError("Üretim kaydı bulunamadı.");
    }
    const canViewAll = membership.role === "ADMIN" || permissions.canViewAiCosts;
    if (!canViewAll && generation.userId !== session.user.id) {
      throw new PermissionError("Bu üretim kaydını görüntüleme yetkiniz yok.");
    }

    return NextResponse.json({ generation });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH: bir üretimin sonucu hakkında karar verir (ACCEPTED/EDITED/
 * REJECTED). Bu uç nokta hiçbir zaman doğrudan SocialContent/BlogContent
 * alanına yazmaz — kullanıcı, döndürülen (veya düzenlediği) metni ilgili
 * içerik formuna KENDİSİ yapıştırır/kaydeder (bkz. proje talebi §9 —
 * "her zaman insan onayı gerekir").
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { generationId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = decideContentAiGenerationSchema.parse(body);

    const generation = await decideContentAiGeneration(
      generationId,
      session.user.id,
      membership.role === "ADMIN",
      data.decision,
      data.editedOutput,
    );

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "AI_CONTENT_GENERATED",
      module: "CONTENT",
      message: `Yapay zekâ üretimi için karar verildi: ${data.decision}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ generation });
  } catch (error) {
    return handleApiError(error);
  }
}
