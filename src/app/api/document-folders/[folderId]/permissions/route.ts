import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireFolderAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { grantDocumentPermissionSchema } from "@/lib/validations";
import { logActivity, getClientIp, notifyUser } from "@/lib/activity";
import { logDocumentAudit } from "@/lib/document-audit";

interface Params {
  params: Promise<{ folderId: string }>;
}

/**
 * POST: Bir klasörü paylaşır — içindeki tüm doküman ve alt klasörler
 * (kendi doküman-seviyesi izinleri olmadığı sürece) bu izni miras alır
 * (bkz. src/lib/documents.ts'teki kalıtım zinciri).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { folderId } = await params;
    const level = await requireFolderAccess(folderId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = grantDocumentPermissionSchema.parse(body);

    if (data.level === "OWNER" && level !== "OWNER") {
      throw new PermissionError("Sahiplik düzeyinde yetki vermek için klasör sahibi olmanız gerekir.");
    }

    const folder = await prisma.documentFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.deletedAt) throw new NotFoundError("Klasör bulunamadı.");

    const permission = await prisma.documentPermission.create({
      data: {
        folderId,
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
      documentTitleSnapshot: folder.name,
      actorId: session.user.id,
      action: "PERMISSION_GRANTED",
      newValue: `${data.subjectType}:${data.subjectUserId || data.subjectTeamId || data.subjectRole || "EVERYONE"} → ${data.level}`,
      description: `Klasör: ${folder.name}`,
      ipAddress: ip,
    });
    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DOCUMENT_SHARED",
      module: "DOCUMENTS",
      message: `"${folder.name}" klasörünü paylaştı.`,
      ipAddress: ip,
    });

    if (data.subjectType === "USER" && data.subjectUserId && data.subjectUserId !== session.user.id) {
      await notifyUser({
        userId: data.subjectUserId,
        title: "Bir klasör sizinle paylaşıldı",
        message: `"${folder.name}" klasörüne erişim verildi.`,
        link: `/ortak-alan?folder=${folderId}`,
        type: "DOCUMENT_SHARED",
      });
    }

    return NextResponse.json({ permission }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
