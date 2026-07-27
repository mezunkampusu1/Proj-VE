import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";

/**
 * GET: Yapay zekâ üretim geçmişi. `canViewAiCosts` (veya ADMIN) tüm takımın
 * üretimlerini + maliyetlerini görür (bkz. proje talebi §9 — "yapay zekâ
 * maliyetleri raporlanabilmeli"); aksi halde kullanıcı yalnızca kendi
 * geçmişini görür. `AiGeneration` bir `teamId` sütunu taşımaz (tek çalışma
 * alanı basitleştirmesi) — "takımın tamamı" burada workspace üyeliği
 * üzerinden çözülür.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canUseAi, "Yapay zekâ özelliklerini kullanma yetkiniz yok.");

    const canViewAll = membership.role === "ADMIN" || permissions.canViewAiCosts;

    const { searchParams } = new URL(req.url);
    const actionType = searchParams.get("actionType");
    const decision = searchParams.get("decision");
    const requestedUserId = searchParams.get("userId");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "30") || 30));

    let userIdFilter: string | { in: string[] } = session.user.id;
    if (canViewAll) {
      if (requestedUserId) {
        userIdFilter = requestedUserId;
      } else {
        const members = await prisma.teamMember.findMany({
          where: { teamId: workspace.id },
          select: { userId: true },
        });
        userIdFilter = { in: members.map((m) => m.userId) };
      }
    }

    const where = {
      userId: userIdFilter,
      ...(actionType ? { actionType: actionType as never } : {}),
      ...(decision ? { decision: decision as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.aiGeneration.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.aiGeneration.count({ where }),
    ]);

    const totalCostUsd = canViewAll
      ? (await prisma.aiGeneration.aggregate({ where, _sum: { estimatedCostUsd: true } }))._sum
          .estimatedCostUsd ?? 0
      : undefined;

    return NextResponse.json({ items, total, page, pageSize, totalCostUsd });
  } catch (error) {
    return handleApiError(error);
  }
}
