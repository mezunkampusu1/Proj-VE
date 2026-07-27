import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { searchDocumentIdsByText } from "@/lib/document-search";
import type { Prisma, DocumentStatus } from "@prisma/client";

const searchResultInclude = {
  type: true,
  folder: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.DocumentInclude;

/**
 * GET: Güçlü arama (§ arama ve filtreleme). Başlık + içerik üzerinde
 * Türkçe tam metin arama (`q`), artı isteğe bağlı filtreler: folderId,
 * typeId, status, tagId, ownerId, updatedFrom/updatedTo. Yalnızca
 * kullanıcının erişebildiği (kalıcı silinmemiş, şablon olmayan) dokümanlar
 * döner — erişim kümesi documents/route.ts'teki "shared/varsayılan" kapsam
 * mantığıyla AYNI (tek seviye klasör kalıtımı basitleştirmesi burada da
 * geçerli, tutarlılık için).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const isAdmin = membership.role === "ADMIN";

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const folderId = searchParams.get("folderId");
    const typeId = searchParams.get("typeId");
    const status = searchParams.get("status");
    const tagId = searchParams.get("tagId");
    const ownerId = searchParams.get("ownerId");
    const updatedFrom = searchParams.get("updatedFrom");
    const updatedTo = searchParams.get("updatedTo");
    const includeTemplates = searchParams.get("includeTemplates") === "1";

    const where: Prisma.DocumentWhereInput = { deletedAt: null, archivedAt: null };
    if (!includeTemplates) where.isTemplate = false;
    if (folderId) where.folderId = folderId;
    if (typeId) where.typeId = typeId;
    if (status) where.status = status as DocumentStatus;
    if (ownerId) where.ownerId = ownerId;
    if (tagId) where.tags = { some: { tagId } };
    if (updatedFrom || updatedTo) {
      where.updatedAt = {
        ...(updatedFrom ? { gte: new Date(updatedFrom) } : {}),
        ...(updatedTo ? { lte: new Date(updatedTo) } : {}),
      };
    }

    let candidateIds: string[] | null = null; // null => sınırsız (admin)
    if (!isAdmin) {
      const perms = await prisma.documentPermission.findMany({
        where: {
          OR: [
            { subjectType: "USER", subjectUserId: session.user.id },
            {
              subjectType: "TEAM",
              subjectTeamId: {
                in: (await prisma.teamMember.findMany({ where: { userId: session.user.id }, select: { teamId: true } })).map(
                  (m) => m.teamId,
                ),
              },
            },
            { subjectType: "ROLE", subjectRole: membership.role },
            { subjectType: "EVERYONE" },
          ],
        },
        select: { documentId: true, folderId: true },
      });
      const sharedDocIds = perms.map((p) => p.documentId).filter((v): v is string => !!v);
      const sharedFolderIds = perms.map((p) => p.folderId).filter((v): v is string => !!v);

      const accessible = await prisma.document.findMany({
        where: {
          deletedAt: null,
          OR: [
            { ownerId: session.user.id },
            ...(sharedDocIds.length ? [{ id: { in: sharedDocIds } }] : []),
            ...(sharedFolderIds.length ? [{ folderId: { in: sharedFolderIds } }] : []),
          ],
        },
        select: { id: true },
      });
      candidateIds = accessible.map((d) => d.id);
    }

    let rankById: Map<string, number> | null = null;
    if (q.trim()) {
      rankById = await searchDocumentIdsByText(q, candidateIds);
      where.id = { in: Array.from(rankById.keys()) };
    } else if (candidateIds) {
      where.id = { in: candidateIds.length ? candidateIds : ["__none__"] };
    }

    const documents = await prisma.document.findMany({
      where,
      include: searchResultInclude,
      orderBy: rankById ? undefined : [{ updatedAt: "desc" }],
      take: 100,
    });

    const results = rankById
      ? [...documents].sort((a, b) => (rankById!.get(b.id) ?? 0) - (rankById!.get(a.id) ?? 0))
      : documents;

    return NextResponse.json({ documents: results });
  } catch (error) {
    return handleApiError(error);
  }
}
