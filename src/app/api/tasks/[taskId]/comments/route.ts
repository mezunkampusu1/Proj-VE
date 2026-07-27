import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validations";
import { requireTaskAccess } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, notifyUser, getClientIp } from "@/lib/activity";
import { extractMentionedUserIds } from "@/lib/tasks";

interface Params {
  params: Promise<{ taskId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { taskId } = await params;
    const { task } = await requireTaskAccess(taskId, session.user.id);

    const body = await req.json();
    const data = createCommentSchema.parse(body);

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: session.user.id,
        body: data.body,
        // Görevlendirme #200: zengin metin editöründen gelen Tiptap JSON
        // ağacı — dolu ise arayüz bunu render eder, NULL ise eski düz
        // metin `body` kullanılır (bkz. schema.prisma yorum).
        bodyJson: data.bodyJson ?? undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    await logActivity({
      teamId: task.project.teamId,
      projectId: task.project.id,
      taskId,
      userId: session.user.id,
      action: "COMMENT_ADDED",
      message: `"${task.title}" görevine not eklendi.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
      select: { userId: true },
    });
    for (const a of assignees) {
      if (a.userId === session.user.id) continue;
      await notifyUser({
        userId: a.userId,
        type: "TASK_COMMENT",
        title: "Yeni not",
        message: `"${task.title}" görevine yeni bir not eklendi.`,
        link: `/teams/${task.project.teamId}/projects/${task.project.id}`,
      });
    }

    // @mention: notda etiketlenen ekip üyelerine bildirim gönderilir. Sadece
    // aynı takımın üyesi olan ve yazarın kendisi olmayan kullanıcılar
    // dikkate alınır (belirteç sahte/yanlış bir userId taşısa bile güvenli).
    // Görevlendirme #200: zengin metin editörü etiketlenen kişileri metne
    // gömülü belirteç yerine doğrudan mentionedUserIds dizisiyle gönderir
    // (editör zaten kimin etiketlendiğini yapısal olarak biliyor) — eski
    // düz metin akışıyla geriye dönük uyumluluk için ikisi birleştirilir.
    const mentionedIds = Array.from(
      new Set([...extractMentionedUserIds(data.body), ...(data.mentionedUserIds ?? [])]),
    ).filter((id) => id !== session.user.id);
    if (mentionedIds.length > 0) {
      const validMembers = await prisma.teamMember.findMany({
        where: { teamId: task.project.teamId, userId: { in: mentionedIds } },
        select: { userId: true },
      });
      for (const member of validMembers) {
        await notifyUser({
          userId: member.userId,
          type: "TASK_MENTIONED",
          title: "Bir notta etiketlendiniz",
          message: `${session.user.name || session.user.email} sizi "${task.title}" görevindeki bir notta etiketledi.`,
          link: `/teams/${task.project.teamId}/projects/${task.project.id}`,
        });
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
