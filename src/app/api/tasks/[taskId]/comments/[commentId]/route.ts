import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTaskAccess, NotFoundError, PermissionError } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ taskId: string; commentId: string }>;
}

/**
 * PATCH: Notlar (task comment) içindeki kontrol listesi (checklist)
 * kutucuklarının işaretli/işaretsiz durumunu kaydeder (bkz. kullanıcı
 * talebi: "Notlar kısmında kutucuk yanına tik koyulmuyor" — salt-okunur
 * render'daki tıklama görsel olarak çalışıyordu ama sunucuya hiç
 * kaydedilmiyordu, F5'te sıfırlanıyordu). Ortak bir kontrol listesi
 * olduğundan yazar dışındaki görev erişimi olan herkes de işaretleyebilir.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, commentId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.taskId !== taskId) {
      throw new NotFoundError("Not bulunamadı.");
    }

    const body = await req.json();
    if (typeof body !== "object" || body === null || !("bodyJson" in body)) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    const updated = await prisma.taskComment.update({
      where: { id: commentId },
      data: { bodyJson: body.bodyJson },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Revizyon: "notlar kısmına yanlış girilebilir diye silme tuşu" isteği —
 * eklerin silinmesiyle aynı yetki kuralı: yazarın kendisi veya takım
 * yöneticisi silebilir (bkz. attachments/[attachmentId]/route.ts DELETE).
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, commentId } = await params;
    const { membership } = await requireTaskAccess(taskId, session.user.id);

    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.taskId !== taskId) {
      throw new NotFoundError("Not bulunamadı.");
    }

    const canDelete = membership.role === "ADMIN" || comment.userId === session.user.id;
    if (!canDelete) {
      throw new PermissionError("Bu notu silme yetkiniz yok.");
    }

    await prisma.taskComment.delete({ where: { id: commentId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
