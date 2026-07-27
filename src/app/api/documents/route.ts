import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";
import type { Prisma, DocumentStatus } from "@prisma/client";

const documentListInclude = {
  type: true,
  folder: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  lastEditedBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, favorites: true } },
} satisfies Prisma.DocumentInclude;

/**
 * GET: Doküman listesi. `scope` parametresi hangi kümenin döneceğini
 * belirler:
 *  - mine: sahip olduğum dokümanlar
 *  - shared: benimle paylaşılanlar (açık izin kaydı üzerinden)
 *  - team: tüm ekip dokümanları (yalnızca yönetici)
 *  - templates: kullanılabilir şablonlar (sistem + kendi şablonlarım)
 *  - trash: çöp kutusu (kendi dokümanlarım + yönetici hepsini görür)
 *  - archive: arşivlenmiş dokümanlar (kendi dokümanlarım + yönetici hepsini görür)
 *  - (belirtilmezse): mine ∪ shared — ana ekran varsayılanı
 *
 * Arşivlenmiş dokümanlar (`archivedAt` dolu) `archive` DIŞINDAKİ tüm
 * kapsamlarda gizlenir — arşivleme, çöp kutusundan farklı olarak geri
 * dönüşü kolay bir "görünürlükten kaldırma" işlemidir.
 *
 * Not: "shared" ve varsayılan kapsam, klasör kalıtımını TEK seviye
 * (dokümanın doğrudan bağlı olduğu klasör) üzerinden hesaplar; nokta
 * atışı erişim kontrolü (requireDocumentAccess) her zaman tam kalıtım
 * zincirini kullanır — bu yalnızca liste ekranı için bir performans
 * basitleştirmesidir.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const isAdmin = membership.role === "ADMIN";

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "default";
    const folderId = searchParams.get("folderId");
    const status = searchParams.get("status");
    const typeId = searchParams.get("typeId");
    const projectId = searchParams.get("projectId");
    const favoritesOnly = searchParams.get("favorites") === "1";
    const pinnedOnly = searchParams.get("pinned") === "1";

    const baseWhere: Prisma.DocumentWhereInput = {};
    if (folderId) baseWhere.folderId = folderId;
    if (status) baseWhere.status = status as DocumentStatus;
    if (typeId) baseWhere.typeId = typeId;
    if (projectId) baseWhere.projectId = projectId;
    if (favoritesOnly) baseWhere.favorites = { some: { userId: session.user.id } };
    if (pinnedOnly) baseWhere.isPinned = true;

    let where: Prisma.DocumentWhereInput;

    if (scope === "trash") {
      where = {
        ...baseWhere,
        deletedAt: { not: null },
        ...(isAdmin ? {} : { ownerId: session.user.id }),
      };
    } else if (scope === "archive") {
      where = {
        ...baseWhere,
        deletedAt: null,
        archivedAt: { not: null },
        ...(isAdmin ? {} : { ownerId: session.user.id }),
      };
    } else if (scope === "templates") {
      where = {
        ...baseWhere,
        isTemplate: true,
        deletedAt: null,
        OR: [{ isSystemTemplate: true }, { createdById: session.user.id }],
      };
    } else if (scope === "mine") {
      where = { ...baseWhere, deletedAt: null, archivedAt: null, isTemplate: false, ownerId: session.user.id };
    } else if (scope === "team") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Bu görünüm için yönetici olmanız gerekir." }, { status: 403 });
      }
      where = { ...baseWhere, deletedAt: null, archivedAt: null, isTemplate: false };
    } else {
      // "shared" veya varsayılan: sahip olduklarım + açıkça paylaşılanlar.
      const perms = await prisma.documentPermission.findMany({
        where: {
          OR: [
            { subjectType: "USER", subjectUserId: session.user.id },
            {
              subjectType: "TEAM",
              subjectTeamId: { in: (await prisma.teamMember.findMany({ where: { userId: session.user.id }, select: { teamId: true } })).map((m) => m.teamId) },
            },
            { subjectType: "ROLE", subjectRole: membership.role },
            { subjectType: "EVERYONE" },
          ],
        },
        select: { documentId: true, folderId: true },
      });
      const sharedDocIds = perms.map((p) => p.documentId).filter((v): v is string => !!v);
      const sharedFolderIds = perms.map((p) => p.folderId).filter((v): v is string => !!v);

      const ownershipOr: Prisma.DocumentWhereInput[] = [{ ownerId: session.user.id }];
      if (scope === "shared") {
        if (sharedDocIds.length > 0) ownershipOr.push({ id: { in: sharedDocIds } });
        if (sharedFolderIds.length > 0) ownershipOr.push({ folderId: { in: sharedFolderIds } });
        where = { ...baseWhere, deletedAt: null, archivedAt: null, isTemplate: false, AND: [{ ownerId: { not: session.user.id } }], OR: ownershipOr.slice(1).length ? ownershipOr.slice(1) : [{ id: "__none__" }] };
      } else {
        if (sharedDocIds.length > 0) ownershipOr.push({ id: { in: sharedDocIds } });
        if (sharedFolderIds.length > 0) ownershipOr.push({ folderId: { in: sharedFolderIds } });
        where = isAdmin
          ? { ...baseWhere, deletedAt: null, archivedAt: null, isTemplate: false }
          : { ...baseWhere, deletedAt: null, archivedAt: null, isTemplate: false, OR: ownershipOr };
      }
    }

    const documents = await prisma.document.findMany({
      where,
      include: documentListInclude,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Yeni doküman oluşturur. "Boş Doküman" veya `templateDocumentId`
 * verilirse "Şablondan Oluştur" akışı — şablonun içeriği KOPYALANIR, yeni
 * doküman şablondan tamamen bağımsız hale gelir (§14).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = createDocumentSchema.parse(body);

    let content: Prisma.InputJsonValue | undefined;
    let contentText: string | undefined;
    let wordCount = 0;
    let charCount = 0;

    if (data.templateDocumentId) {
      const template = await prisma.document.findUnique({
        where: { id: data.templateDocumentId },
        select: { content: true, contentText: true, wordCount: true, charCount: true, isTemplate: true, deletedAt: true },
      });
      if (!template || template.deletedAt) {
        return NextResponse.json({ error: "Seçilen şablon bulunamadı." }, { status: 404 });
      }
      content = (template.content ?? undefined) as Prisma.InputJsonValue | undefined;
      contentText = template.contentText ?? undefined;
      wordCount = template.wordCount;
      charCount = template.charCount;
    }

    const document = await prisma.document.create({
      data: {
        title: data.title,
        description: data.description || undefined,
        typeId: data.typeId || undefined,
        folderId: data.folderId || undefined,
        teamId: workspace.id,
        projectId: data.projectId || undefined,
        ownerId: session.user.id,
        createdById: session.user.id,
        content,
        contentText,
        wordCount,
        charCount,
        tags: data.tagIds?.length
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: documentListInclude,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_CREATED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını oluşturdu.`,
      ipAddress: getClientIp(req),
    });
    await logDocumentAudit({
      documentId: document.id,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "CREATED",
      description: data.templateDocumentId ? "Şablondan oluşturuldu." : "Boş doküman olarak oluşturuldu.",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
