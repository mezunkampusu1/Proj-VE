import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { readStoredFile } from "@/lib/storage";
import { NotFoundError } from "@/lib/permissions";

interface Params {
  params: Promise<{ taskId: string; attachmentId: string }>;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId, attachmentId } = await params;
    await requireTaskAccess(taskId, session.user.id);

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.taskId !== taskId) {
      throw new NotFoundError("Ek bulunamadı.");
    }

    // LINK türü ekler (bkz. görev #197) diskte gerçek bir dosya
    // barındırmaz — indirme isteği doğrudan dış bağlantıya yönlendirilir.
    if (attachment.kind === "LINK") {
      if (!attachment.externalUrl) throw new NotFoundError("Bağlantı bulunamadı.");
      return NextResponse.redirect(attachment.externalUrl);
    }

    if (!attachment.storedPath) throw new NotFoundError("Dosya bulunamadı.");
    const buffer = await readStoredFile(attachment.storedPath);

    // `?inline=1` ile çağrıldığında (resim/PDF önizlemesi için — bkz.
    // task-modal.tsx) tarayıcı içi görüntüleme, aksi halde her zamanki
    // gibi "farklı kaydet" indirmesi tetiklenir.
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    const fileName = attachment.fileName || "dosya";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(attachment.fileSize ?? buffer.byteLength),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
