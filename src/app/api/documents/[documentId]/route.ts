import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { updateDocumentSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";
import type { Prisma } from "@prisma/client";
import { getDocumentFormat } from "@/lib/document-format";

interface Params {
  params: Promise<{ documentId: string }>;
}

const documentDetailInclude = {
  type: true,
  folder: { select: { id: true, name: true, parentFolderId: true } },
  owner: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  lastEditedBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  permissions: {
    include: {
      subjectUser: { select: { id: true, name: true, email: true } },
      subjectTeam: { select: { id: true, name: true } },
      grantedBy: { select: { id: true, name: true } },
    },
  },
  favorites: true,
  followers: true,
  _count: { select: { comments: true, versions: true, suggestions: true } },
} satisfies Prisma.DocumentInclude;

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: documentDetailInclude,
    });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const isFavorite = document.favorites.some((f) => f.userId === session.user.id);
    const isFollowing = document.followers.some((f) => f.userId === session.user.id);

    return NextResponse.json({ document, accessLevel: level, isFavorite, isFollowing });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH: Doküman meta verilerini günceller (başlık/açıklama/tür/klasör/durum/etiketler). */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    // Durum değişikliği dahil meta veri güncellemeleri en az EDITOR gerektirir.
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = updateDocumentSchema.parse(body);

    if (data.isSystemTemplate !== undefined && membership.role !== "ADMIN") {
      throw new PermissionError("Bir dokümanı sistem şablonu yapmak için yönetici olmanız gerekir.");
    }

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    // İçerik (content) yalnızca Excel türü dokümanlar için bu uçtan
    // kaydedilir — Word dokümanları canlı işbirliği (Yjs) kullandığı için
    // içerikleri ayrı bir yoldan (collab-server'ın onStoreDocument kancası)
    // kaydedilir; buradan yazılırsa Yjs'in "gerçek" durumuyla çakışır.
    const effectiveTypeId = data.typeId === undefined ? existing.typeId : data.typeId || null;
    const isExcelDocument = getDocumentFormat(effectiveTypeId) === "EXCEL";
    if (data.content !== undefined && !isExcelDocument) {
      return NextResponse.json(
        { error: "İçerik yalnızca Excel türü dokümanlar için bu uçtan kaydedilebilir." },
        { status: 400 },
      );
    }

    // Görevlendirme #328/#329 (veri kaybı raporu, sonra "hiçbirşeyi
    // kaydetmiyor" regresyonu): burada dolu bir dokümanı sıfır hücreye
    // indiren kayıtları REDDEDEN bir güvenlik ağı vardı. Hem hücre sayarak
    // hem de JSON boyutuna bakarak denendi, ikisi de YANLIŞ POZİTİF verip
    // kullanıcının gerçek düzenlemelerini kaydedilemez hâle getirdi — bu
    // yüzden tamamen kaldırıldı. Veri kaybına karşı koruma artık ENGELLEME değil, istemci
    // tarafında dokümanı ilk açışta alınan otomatik bir Sürüm Geçmişi
    // anlık görüntüsü ile sağlanıyor (bkz. spreadsheet-editor.tsx).
    const document = await prisma.$transaction(async (tx) => {
      if (data.tagIds) {
        await tx.documentTag.deleteMany({ where: { documentId } });
        if (data.tagIds.length > 0) {
          await tx.documentTag.createMany({
            data: data.tagIds.map((tagId) => ({ documentId, tagId })),
          });
        }
      }
      return tx.document.update({
        where: { id: documentId },
        data: {
          title: data.title,
          description: data.description === undefined ? undefined : data.description,
          typeId: data.typeId === undefined ? undefined : data.typeId || null,
          folderId: data.folderId === undefined ? undefined : data.folderId || null,
          projectId: data.projectId === undefined ? undefined : data.projectId || null,
          status: data.status,
          isTemplate: data.isTemplate,
          templateCategory: data.templateCategory === undefined ? undefined : data.templateCategory || null,
          isSystemTemplate: data.isSystemTemplate,
          content: data.content === undefined ? undefined : (data.content as Prisma.InputJsonValue),
          lastEditedById: session.user.id,
        },
        include: documentDetailInclude,
      });
    });

    const ip = getClientIp(req);
    if (data.status && data.status !== existing.status) {
      await logDocumentAudit({
        documentId,
        documentTitleSnapshot: document.title,
        actorId: session.user.id,
        action: "EDITED",
        field: "status",
        oldValue: existing.status,
        newValue: data.status,
        ipAddress: ip,
      });
      await logActivity({
        teamId: workspace.id,
        userId: session.user.id,
        action: "DOCUMENT_STATUS_CHANGED",
        module: "DOCUMENTS",
        message: `"${document.title}" dokümanının durumunu değiştirdi.`,
        ipAddress: ip,
      });
      // Takipçilere ve sahibe durum değişikliği bildirimi.
      const recipients = new Set(document.followers.map((f) => f.userId));
      recipients.add(document.ownerId);
      recipients.delete(session.user.id);
      for (const userId of recipients) {
        await notifyDocumentUser({
          userId,
          title: "Doküman durumu değişti",
          message: `"${document.title}" dokümanının durumu güncellendi.`,
          link: `/ortak-alan/${documentId}`,
          type: "DOCUMENT_UPDATE",
        });
      }
    } else {
      await logDocumentAudit({
        documentId,
        documentTitleSnapshot: document.title,
        actorId: session.user.id,
        action: "EDITED",
        description: "Doküman meta verileri güncellendi.",
        ipAddress: ip,
      });
    }

    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Yumuşak silme — dokümanı çöp kutusuna taşır (§17). */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    // Erişimi olduğunu doğrula (en az VIEWER — varlığını gizlemek için),
    // ama silme yetkisini EDITOR paylaşımına DEĞİL, oluşturan kişi/admin
    // kuralına bağla (bkz. kullanıcı talebi #14: "kendisi oluşturduysa
    // silebilsin ama diğer kullanıcılar silemesin admin hepsini silebilsin"
    // — önceden paylaşılan bir dokümanda EDITOR erişimi olan herkes de
    // silebiliyordu, bu istenmeyen bir davranıştı).
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const existing = await prisma.document.findUnique({ where: { id: documentId } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const isCreator = existing.createdById === session.user.id;
    if (!isCreator && membership.role !== "ADMIN") {
      throw new PermissionError("Bu dokümanı yalnızca oluşturan kişi veya yönetici silebilir.");
    }
    if (existing.isSystemTemplate && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Sistem şablonlarını yalnızca yöneticiler silebilir." }, { status: 403 });
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "DELETED",
      description: "Doküman çöp kutusuna taşındı.",
      ipAddress: getClientIp(req),
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_DELETED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını çöp kutusuna taşıdı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
