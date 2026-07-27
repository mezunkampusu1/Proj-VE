import { prisma } from "@/lib/prisma";
import { PermissionError, NotFoundError } from "@/lib/permissions";
import type { DocumentAccessLevel, TeamRole } from "@prisma/client";

/**
 * Ortak Alan modülü için erişim düzeyi çözümleyicisi. Bu mantık,
 * collab-server/src/db.ts içindeki karşılığıyla KASITLI olarak birebir
 * aynıdır — biri Prisma üzerinden (bu dosya, Next.js API route'ları için),
 * diğeri ham `pg` üzerinden (collab servisi, bağımsız süreç olduğu için
 * Prisma client'a sahip değil) aynı yetki kurallarını uygular. Bu iki
 * yerin senkron kalması önemlidir; biri değişirse diğeri de güncellenmeli.
 */

const LEVEL_RANK: Record<DocumentAccessLevel, number> = {
  VIEWER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
};

function maxLevel(
  a: DocumentAccessLevel | null,
  b: DocumentAccessLevel | null,
): DocumentAccessLevel | null {
  if (!a) return b;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export function levelAtLeast(level: DocumentAccessLevel | null, min: DocumentAccessLevel): boolean {
  if (!level) return false;
  return LEVEL_RANK[level] >= LEVEL_RANK[min];
}

export async function getDocumentAccessLevel(
  userId: string,
  documentId: string,
): Promise<DocumentAccessLevel | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, folderId: true, teamId: true, deletedAt: true },
  });
  if (!doc || doc.deletedAt) return null;

  if (doc.ownerId === userId) return "OWNER";

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });
  if (memberships.length === 0) return null;
  if (memberships.some((m) => m.role === ("ADMIN" as TeamRole))) return "OWNER";

  const teamIds = memberships.map((m) => m.teamId);
  const roles = memberships.map((m) => m.role);

  const subjectFilter = (targetField: "documentId" | "folderId", targetId: string) => ({
    [targetField]: targetId,
    OR: [
      { subjectType: "USER" as const, subjectUserId: userId },
      { subjectType: "TEAM" as const, subjectTeamId: { in: teamIds } },
      { subjectType: "ROLE" as const, subjectRole: { in: roles } },
      { subjectType: "EVERYONE" as const },
    ],
  });

  const docPerms = await prisma.documentPermission.findMany({
    where: subjectFilter("documentId", documentId),
    select: { level: true },
  });
  let level: DocumentAccessLevel | null = null;
  for (const p of docPerms) level = maxLevel(level, p.level);
  if (level) return level;

  let folderId = doc.folderId;
  while (folderId) {
    // `folderId` bir sonraki turda yeniden atandığı için sorgularda sabit
    // bir kopyasını kullanıyoruz — aksi halde TypeScript, `let` ile
    // mutasyona uğrayan bir değişkenin kendi başlatıcısında dolaylı olarak
    // referans verildiğini düşünüp derlemeyi reddediyor (bkz. görev #163).
    const currentFolderId: string = folderId;
    const folderPerms = await prisma.documentPermission.findMany({
      where: subjectFilter("folderId", currentFolderId),
      select: { level: true },
    });
    let folderLevel: DocumentAccessLevel | null = null;
    for (const p of folderPerms) folderLevel = maxLevel(folderLevel, p.level);
    if (folderLevel) return folderLevel;

    const folder = await prisma.documentFolder.findUnique({
      where: { id: currentFolderId },
      select: { parentFolderId: true },
    });
    folderId = folder?.parentFolderId ?? null;
  }

  return null;
}

/**
 * Bir kullanıcının bir klasöre erişim düzeyini çözümler (dokümanla aynı
 * kalıtım mantığı, ancak klasörün kendisinden başlar — doküman-seviyesi
 * kısayolu yoktur).
 */
export async function getFolderAccessLevel(
  userId: string,
  folderId: string,
): Promise<DocumentAccessLevel | null> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });
  if (memberships.length === 0) return null;
  if (memberships.some((m) => m.role === ("ADMIN" as TeamRole))) return "OWNER";

  const teamIds = memberships.map((m) => m.teamId);
  const roles = memberships.map((m) => m.role);

  let currentId: string | null = folderId;
  while (currentId) {
    // Aynı nedenle (bkz. yukarıdaki not, görev #163) sorgu için sabit bir
    // kopya kullanılıyor: `currentId` döngü sonunda yeniden atanıyor.
    const idToQuery: string = currentId;
    const folder = await prisma.documentFolder.findUnique({
      where: { id: idToQuery },
      select: { parentFolderId: true, createdById: true },
    });
    if (!folder) return null;
    if (folder.createdById === userId) return "OWNER";

    const perms = await prisma.documentPermission.findMany({
      where: {
        folderId: idToQuery,
        OR: [
          { subjectType: "USER" as const, subjectUserId: userId },
          { subjectType: "TEAM" as const, subjectTeamId: { in: teamIds } },
          { subjectType: "ROLE" as const, subjectRole: { in: roles } },
          { subjectType: "EVERYONE" as const },
        ],
      },
      select: { level: true },
    });
    let level: DocumentAccessLevel | null = null;
    for (const p of perms) level = maxLevel(level, p.level);
    if (level) return level;

    currentId = folder.parentFolderId;
  }
  return null;
}

export async function requireDocumentAccess(
  documentId: string,
  userId: string,
  minLevel: DocumentAccessLevel = "VIEWER",
) {
  const level = await getDocumentAccessLevel(userId, documentId);
  if (!level) {
    throw new NotFoundError("Doküman bulunamadı veya erişim yetkiniz yok.");
  }
  if (!levelAtLeast(level, minLevel)) {
    throw new PermissionError("Bu işlem için yeterli yetkiniz yok.");
  }
  return level;
}

export async function requireFolderAccess(
  folderId: string,
  userId: string,
  minLevel: DocumentAccessLevel = "VIEWER",
) {
  const level = await getFolderAccessLevel(userId, folderId);
  if (!level) {
    throw new NotFoundError("Klasör bulunamadı veya erişim yetkiniz yok.");
  }
  if (!levelAtLeast(level, minLevel)) {
    throw new PermissionError("Bu işlem için yeterli yetkiniz yok.");
  }
  return level;
}
