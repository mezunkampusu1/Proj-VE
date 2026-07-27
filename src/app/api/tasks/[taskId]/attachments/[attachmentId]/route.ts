import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { deleteStoredFile } from "@/lib/storage";
import { logActivity, getClientIp } from "@/lib/activity";
import { NotFoundError, PermissionError } from "@/lib/permissions";
import { updateTaskAttachmentSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ taskId: string; attachmentId: string }>;
}

/**
 * Görevlendirme #199, revizyon #327: bir ekin görev kartının KAPAK (banner)
 * görseli olarak gösterilip gösterilmeyeceğini değiştirir. Kullanıcı talebi
 * netleşti: "kartta göster demek kartın resmini değiştirmek demek ondada
 * bir tane seçme hakkımız olsun" — yani bu artık çoklu değil TEK seçimli
 * (radio) bir alan. `showOnCard: true` gönderildiğinde, aynı göreve ait
 * DİĞER tüm eklerin kapak işareti tek bir işlemde (transaction) kaldırılır,
 * böylece istemci tarafı yarışlara/çoklu sekmeye karşı da tutarlılık
 * sunucuda garanti edilir. Diğer TÜM ekler (kapak olsun olmasın) zaten
 * kartta otomatik ikon rozeti olarak görünür (bkz. task-card.tsx) — bu
 * uç nokta yalnızca kapak seçimini yönetir. Yalnızca ekleyen kişi veya
 * takım yöneticisi değil — herhangi bir görev üyesi bu görsel tercihi
 * değiştirebilir (silme yetkisinden farklı olarak, bu salt görüntüleme
 * tercihi olduğu için erişimi kısıtlamaya gerek yok).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, attachmentId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const attachment = await prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.taskId !== taskId) {
      throw new NotFoundError("Ek bulunamadı.");
    }

    const body = await req.json();
    const data = updateTaskAttachmentSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.showOnCard) {
        await tx.taskAttachment.updateMany({
          where: { taskId, id: { not: attachmentId }, showOnCard: true },
          data: { showOnCard: false },
        });
      }
      return tx.taskAttachment.update({
        where: { id: attachmentId },
        data: { showOnCard: data.showOnCard },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });
    });

    return NextResponse.json({ attachment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, attachmentId } = await params;
    const { task, membership } = await requireTaskAccess(taskId, session.user.id);

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.taskId !== taskId) {
      throw new NotFoundError("Ek bulunamadı.");
    }

    const canDelete = membership.role === "ADMIN" || attachment.uploadedById === session.user.id;
    if (!canDelete) {
      throw new PermissionError("Bu eki silme yetkiniz yok.");
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });
    if (attachment.kind === "UPLOAD" && attachment.storedPath) {
      await deleteStoredFile(attachment.storedPath);
    }

    await logActivity({
      teamId: task.project.teamId,
      projectId: task.project.id,
      taskId,
      userId: session.user.id,
      action: "ATTACHMENT_REMOVED",
      module: "TASKS",
      message: `"${task.title}" görevinden "${attachment.fileName}" dosyası kaldırıldı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
