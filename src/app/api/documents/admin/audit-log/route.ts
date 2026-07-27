import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import type { Prisma, DocumentAuditAction } from "@prisma/client";

const PAGE_SIZE = 40;

/**
 * GET: Ortak Alan'a özgü tam denetim kaydı akışı (§22 — yalnızca
 * yöneticiler). Genel ActivityLog'dan AYRI tutulur, çünkü doküman
 * içeriğine/izinlerine dair hassas eylemler normal kullanıcılara asla
 * gösterilmemeli. Basit offset tabanlı sayfalama kullanılır (`page`).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const actorId = searchParams.get("actorId");
    const action = searchParams.get("action");
    const documentId = searchParams.get("documentId");
    const q = searchParams.get("q");

    const where: Prisma.DocumentAuditLogWhereInput = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = action as DocumentAuditAction;
    if (documentId) where.documentId = documentId;
    if (q) where.documentTitleSnapshot = { contains: q, mode: "insensitive" };

    const [logs, total] = await Promise.all([
      prisma.documentAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.documentAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: page * PAGE_SIZE < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
