import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { grantDocumentPermissionSchema } from "@/lib/validations";
import { logActivity, getClientIp } from "@/lib/activity";
import { notifyDocumentUser } from "@/lib/document-notifications";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * POST: Bir dokümanı kullanıcı/ekip/rol/herkes ile paylaşır. Basitleştirme
 * notu: spesifikasyondaki "Owner/Edit/Comment/View/İndirme/Paylaşma/Yetki
 * Yönetimi" ayrımı, veritabanında 4 düzeye indirgendi (VIEWER/COMMENTER/
 * EDITOR/OWNER — bkz. §139 şema kararı); indirme her erişim düzeyinde
 * serbest, paylaşma/yetki yönetimi EDITOR ve üzeri ile sınırlıdır, yeni
 * OWNER ataması ise yalnızca mevcut OWNER/yönetici yapabilir.
 * URL üzerinden yetkisiz erişim asla mümkün değildir: paylaşım yapılmamış
 * bir dokümana hiç kimse (admin hariç) erişemez.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = grantDocumentPermissionSchema.parse(body);

    if (data.level === "OWNER" && level !== "OWNER") {
      throw new PermissionError("Sahiplik düzeyinde yetki vermek için doküman sahibi olmanız gerekir.");
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    if (data.subjectType === "USER" && data.subjectUserId) {
      const targetMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: workspace.id, userId: data.subjectUserId } },
      });
      if (!targetMembership) {
        return NextResponse.json({ error: "Seçilen kullanıcı bu ekibin üyesi değil." }, { status: 400 });
      }
    }

    const permission = await prisma.documentPermission.create({
      data: {
        documentId,
        subjectType: data.subjectType,
        subjectUserId: data.subjectType === "USER" ? data.subjectUserId : undefined,
        subjectTeamId: data.subjectType === "TEAM" ? data.subjectTeamId : undefined,
        subjectRole: data.subjectType === "ROLE" ? data.subjectRole : undefined,
        level: data.level,
        grantedById: session.user.id,
      },
      include: {
        subjectUser: { select: { id: true, name: true, email: true } },
        subjectTeam: { select: { id: true, name: true } },
      },
    });

    const ip = getClientIp(req);
    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "PERMISSION_GRANTED",
      newValue: `${data.subjectType}:${data.subjectUserId || data.subjectTeamId || data.subjectRole || "EVERYONE"} → ${data.level}`,
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_SHARED",
      module: "DOCUMENTS",
      message: `"${document.title}" dokümanını paylaştı.`,
      ipAddress: ip,
    });

    if (data.subjectType === "USER" && data.subjectUserId && data.subjectUserId !== session.user.id) {
      await notifyDocumentUser({
        userId: data.subjectUserId,
        title: "Bir doküman sizinle paylaşıldı",
        message: `"${document.title}" dokümanına erişim verildi.`,
        link: `/ortak-alan/${documentId}`,
        type: "DOCUMENT_SHARED",
      });
    } else if (data.subjectType === "EVERYONE" || data.subjectType === "TEAM" || data.subjectType === "ROLE") {
      // Toplu paylaşımlarda tek tek herkese bildirim göndermek yerine
      // yalnızca aktivite akışına yazılır (bildirim gürültüsünü önlemek
      // için) — kullanıcılar dokümanı "Benimle Paylaşılanlar" listesinde
      // bir sonraki ziyaretlerinde görür.
    }

    return NextResponse.json({ permission }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
