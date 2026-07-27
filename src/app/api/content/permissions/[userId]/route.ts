import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateContentPermissionSchema } from "@/lib/validations";
import { requireTeamAdmin, requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { MEMBER_DEFAULTS } from "@/lib/content-permissions";

interface Params {
  params: Promise<{ userId: string }>;
}

/**
 * Bir MEMBER kullanıcının içerik modülü yetki override satırını oluşturur/
 * günceller (bkz. proje talebi §14, `finance/permissions/[userId]/route.ts`
 * ile BİREBİR AYNI desen). Bu uç nokta bilerek `canManageSettings` gibi
 * ContentPermission bayraklarından değil, DOĞRUDAN takım rolünden (ADMIN)
 * yetki alır — yetkileri düzenleyebilme yetkisinin kendisi, düzenlenen
 * yetkilerin bir parçası olamaz.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { userId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const targetMembership = await requireTeamMember(workspace.id, userId).catch(() => {
      throw new NotFoundError("Kullanıcı bu ekibin üyesi değil.");
    });
    if (targetMembership.role === "ADMIN") {
      return NextResponse.json(
        { error: "ADMIN rolündeki kullanıcılar için yetki override tanımlanamaz — zaten tüm yetkilere sahipler." },
        { status: 400 },
      );
    }

    const body = await req.json();
    const data = updateContentPermissionSchema.parse(body);

    const permission = await prisma.contentPermission.upsert({
      where: { userId },
      create: { userId, ...MEMBER_DEFAULTS, ...data, updatedById: session.user.id },
      update: { ...data, updatedById: session.user.id },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "CONTENT_PERMISSION_UPDATED",
      module: "CONTENT",
      message: `Kullanıcının içerik modülü yetkileri güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ permission });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Override satırını siler — kullanıcı tekrar MEMBER_DEFAULTS'a döner. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { userId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    await prisma.contentPermission.deleteMany({ where: { userId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "CONTENT_PERMISSION_UPDATED",
      module: "CONTENT",
      message: `Kullanıcının içerik modülü yetki override'ı kaldırıldı, varsayılanlara dönüldü.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
