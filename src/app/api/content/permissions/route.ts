import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { MEMBER_DEFAULTS } from "@/lib/content-permissions";

/**
 * Üye bazlı içerik modülü yetki override listesi — yalnızca ADMIN görebilir/
 * yönetebilir (bkz. proje talebi §14, `finance/permissions/route.ts` ile
 * BİREBİR AYNI desen). ADMIN rolündeki kullanıcılar listeye dahil edilmez;
 * ADMIN zaten her zaman tüm yetkilere sahiptir ve bu tablodan bağımsızdır.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const members = await prisma.teamMember.findMany({
      where: { teamId: workspace.id, role: "MEMBER" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    });

    const overrides = await prisma.contentPermission.findMany({
      where: { userId: { in: members.map((m) => m.userId) } },
    });
    const overrideMap = new Map(overrides.map((o) => [o.userId, o]));

    const rows = members.map((m) => ({
      user: m.user,
      permissions: overrideMap.get(m.userId) ?? { userId: m.userId, ...MEMBER_DEFAULTS },
      hasOverride: overrideMap.has(m.userId),
    }));

    return NextResponse.json({ members: rows, defaults: MEMBER_DEFAULTS });
  } catch (error) {
    return handleApiError(error);
  }
}
