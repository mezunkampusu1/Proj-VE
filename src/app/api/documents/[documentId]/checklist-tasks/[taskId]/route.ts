import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";

interface Params {
  params: Promise<{ documentId: string; taskId: string }>;
}

const toggleSchema = z.object({ checked: z.boolean() });

/**
 * PATCH: Doküman içindeki kontrol listesi kutusunun işaretlenmesi/
 * işaretinin kaldırılması, bağlı görevi MEVCUT Kanban modülünde
 * tamamlanmış/tamamlanmamış sütuna taşır (§7 — "bidirectional sync",
 * bu yön: doküman → görev, canlı ve anında). Ters yön için bkz.
 * linked-task-item.ts başındaki not.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId, taskId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    // Not: requireTaskAccess KASITLI OLARAK kullanılmıyor — o fonksiyon artık
    // görev bazlı görünürlük kontrolü de yapıyor (bkz. lib/permissions.ts,
    // "kişiyi etiketlemediğim halde görevi görebiliyor" hata düzeltmesi).
    // Burada asıl yetki kaynağı zaten yukarıdaki requireDocumentAccess —
    // dokümanı düzenleyebilen biri, dokümandaki kontrol listesinden türeyen
    // görevin durumunu değiştirebilmeli, görevin kendisinde atanan/oluşturan
    // olması ŞART değil (bkz. §7 bidirectional sync).
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, teamId: true } } },
    });
    if (!existing) {
      throw new NotFoundError("Görev bulunamadı.");
    }
    await requireTeamMember(existing.project.teamId, session.user.id);
    if (existing.sourceDocumentId !== documentId) {
      throw new NotFoundError("Bu görev bu dokümana bağlı değil.");
    }

    const { checked } = toggleSchema.parse(await req.json());

    const targetColumn = checked
      ? await prisma.taskColumn.findFirst({ where: { projectId: existing.projectId, isDoneColumn: true } })
      : await prisma.taskColumn.findFirst({
          where: { projectId: existing.projectId, isDoneColumn: false },
          orderBy: { order: "asc" },
        });

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        columnId: targetColumn?.id ?? undefined,
        completedAt: checked ? new Date() : null,
      },
    });

    await logActivity({
      teamId: existing.project.teamId,
      projectId: existing.project.id,
      taskId,
      userId: session.user.id,
      action: "TASK_STATUS_CHANGED",
      module: "TASKS",
      message: `"${task.title}" görevi doküman kontrol listesinden ${checked ? "tamamlandı" : "yeniden açıldı"}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}
