import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { saveFile, MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { logActivity, getClientIp } from "@/lib/activity";
import { createTaskAttachmentLinkSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ taskId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    const { task } = await requireTaskAccess(taskId, session.user.id);

    // Görev #197: iki farklı gövde biçimi desteklenir — gerçek dosya
    // yüklemeleri multipart/form-data (mevcut davranış), dış bağlantılar
    // (ör. bir YouTube videosu) application/json ile gelir. Hangisi
    // olduğu Content-Type başlığından ayırt edilir.
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const data = createTaskAttachmentLinkSchema.parse(body);

      const attachment = await prisma.taskAttachment.create({
        data: {
          taskId,
          kind: "LINK",
          fileName: data.title?.trim() || data.url,
          externalUrl: data.url,
          uploadedById: session.user.id,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await logActivity({
        teamId: task.project.teamId,
        projectId: task.project.id,
        taskId,
        userId: session.user.id,
        action: "ATTACHMENT_ADDED",
        module: "TASKS",
        message: `"${task.title}" görevine bir bağlantı eklendi.`,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ attachment }, { status: 201 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Dosya boyutu 25 MB'ı aşamaz." }, { status: 413 });
    }

    const saved = await saveFile(file);

    const attachment = await prisma.taskAttachment.create({
      data: {
        ...saved,
        kind: "UPLOAD",
        taskId,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      teamId: task.project.teamId,
      projectId: task.project.id,
      taskId,
      userId: session.user.id,
      action: "ATTACHMENT_ADDED",
      module: "TASKS",
      message: `"${task.title}" görevine "${attachment.fileName}" dosyası eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
