import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

/**
 * GET: Ortak Alan yönetici paneli için özet istatistikler (§ admin
 * dashboard). Yalnızca yöneticiler görebilir. Denetim kaydı listesinin
 * TAMAMI görev #160'ta ayrı bir sayfada sunulacak — burada yalnızca son
 * birkaç kayıt önizleme olarak gösterilir.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const [
      totalDocuments,
      totalFolders,
      totalTemplates,
      trashCount,
      archivedCount,
      pendingApprovals,
      byStatusRaw,
      byTypeRaw,
      aggregates,
      recentAudit,
    ] = await Promise.all([
      prisma.document.count({ where: { deletedAt: null, isTemplate: false } }),
      prisma.documentFolder.count({ where: { deletedAt: null } }),
      prisma.document.count({ where: { deletedAt: null, isTemplate: true } }),
      prisma.document.count({ where: { deletedAt: { not: null } } }),
      prisma.document.count({ where: { deletedAt: null, archivedAt: { not: null } } }),
      prisma.approvalRequest.count({ where: { status: "PENDING" } }),
      prisma.document.groupBy({
        by: ["status"],
        where: { deletedAt: null, isTemplate: false },
        _count: { _all: true },
      }),
      prisma.document.groupBy({
        by: ["typeId"],
        where: { deletedAt: null, isTemplate: false, typeId: { not: null } },
        _count: { _all: true },
      }),
      prisma.document.aggregate({
        where: { deletedAt: null },
        _sum: { wordCount: true, charCount: true },
      }),
      prisma.documentAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const typeIds = byTypeRaw.map((t) => t.typeId).filter((v): v is string => !!v);
    const types = typeIds.length
      ? await prisma.documentType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : [];
    const typeNameById = new Map(types.map((t) => [t.id, t.name]));

    return NextResponse.json({
      counts: {
        totalDocuments,
        totalFolders,
        totalTemplates,
        trashCount,
        archivedCount,
        pendingApprovals,
      },
      totals: {
        wordCount: aggregates._sum.wordCount ?? 0,
        charCount: aggregates._sum.charCount ?? 0,
      },
      byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count._all })),
      byType: byTypeRaw
        .map((t) => ({ typeId: t.typeId!, typeName: typeNameById.get(t.typeId!) ?? "Bilinmeyen tür", count: t._count._all }))
        .sort((a, b) => b.count - a.count),
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        documentTitleSnapshot: a.documentTitleSnapshot,
        action: a.action,
        description: a.description,
        createdAt: a.createdAt,
        actor: a.actor,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
