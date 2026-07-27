import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskSchema } from "@/lib/validations";
import { requireProjectAccess, taskVisibilityWhere } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, notifyUser, getClientIp } from "@/lib/activity";
import { ensureRecurringTasksForDate } from "@/lib/tasks";
import { toDateOrUndefined } from "@/lib/dates";

interface Params {
  params: Promise<{ projectId: string }>;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
  creator: { select: { id: true, name: true, email: true, image: true } },
  subtasks: true,
  tags: { include: { tag: true } },
  // Görevlendirme #199, revizyon #320/#324/#327: ARTIK "kartta göster"
  // işaretine bakılmaksızın görevin TÜM ekleri çekilir — kullanıcı talebi:
  // "link eklendiği anda kartta göster demesekte icon olarak göster ...
  // hepsini göster". `showOnCard`, TEK bir ekin (yalnızca resim/YouTube)
  // kartın büyük KAPAK görseli olacağını işaretler; diğer tüm ekler kapak
  // olsun olmasın küçük ikon rozeti olarak gösterilir (bkz. task-card.tsx).
  // Makul bir üst sınırla (30) çekilir.
  attachments: {
    orderBy: { createdAt: "asc" },
    take: 30,
    select: { id: true, kind: true, mimeType: true, externalUrl: true, showOnCard: true },
  },
  // Görevlendirme #201: kart üzerinde kırmızı "N not" rozeti için.
  _count: { select: { comments: true } },
} as const;

/**
 * API'nin dışarı verdiği ham Prisma sonucunu (`assignees: [{user}]`,
 * `tags: [{tag}]` — join tablosu şekli) istemcinin beklediği düz şekle
 * çevirir (`assignees: User[]`, `tags: Tag[]`). Görev #196 (çoklu atama)
 * için eklendi; aynı zamanda tags için önceden var olan bir tutarsızlığı
 * da düzeltir — sunucu bileşeni (page.tsx) tags'i zaten düzleştiriyordu
 * ama bu API'den gelen CANLI yeniden çekmelerde (drag-drop sonrası vb.)
 * düzleştirme YOKTU, TaskCard'ın beklediği `tag.name` ile uyuşmuyordu.
 * Görevlendirme revizyonu: aynı düzleştirme artık `attachments`'ı
 * `cardImages` dizisine, `_count.comments`'ı da `commentCount`'a çeviriyor.
 * Revizyon #324/#327: eskiden tekil `cardImage` alanıydı, sonra "kartta
 * göster" işaretli TÜM ekleri tutan bir diziye çevrildi; artık işarete
 * bakılmaksızın görevin TÜM ekleri buraya düşer (bkz. task-card.tsx).
 */
function flattenTask<
  T extends {
    assignees: { user: { id: string; name: string | null; email: string; image: string | null } }[];
    tags: { tag: { id: string; name: string; color: string | null } }[];
    attachments: { id: string; kind: string; mimeType: string | null; externalUrl: string | null; showOnCard: boolean }[];
    _count: { comments: number };
  },
>(task: T) {
  const { attachments, _count, ...rest } = task;
  return {
    ...rest,
    assignees: task.assignees.map((a) => a.user),
    tags: task.tags.map((t) => t.tag),
    cardImages: attachments,
    commentCount: _count.comments,
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    const { project, membership } = await requireProjectAccess(projectId, session.user.id);

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || todayIso();

    // Görünürlük kuralı — TEK kaynağı `taskVisibilityWhere` (lib/permissions.ts):
    // proje seviyesinde kişi etiketleme aktifse (project.creatorId dolu),
    // requireProjectAccess zaten bu kullanıcının oluşturan/üye olduğunu
    // doğrulamıştır — projedeki TÜM görevler görünür. Proje hiç
    // etiketlenmemişse eski görev-bazlı kural (oluşturan + atananlar)
    // geçerlidir. Admin her zaman tüm görevleri görür.
    const visibilityWhere = taskVisibilityWhere(project, membership.role, session.user.id);

    // Sabit (FIXED) projelerde gün/tarih kavramı yok — pano her zaman tüm
    // görevleri gösterir, "her gün" şablon taramasına da gerek yok (bkz.
    // proje türü seçimi, create-project-form.tsx).
    if (project.kind === "FIXED") {
      const tasks = await prisma.task.findMany({
        where: { projectId, ...visibilityWhere },
        include: taskInclude,
        orderBy: [{ columnId: "asc" }, { position: "asc" }],
      });
      return NextResponse.json({ tasks: tasks.map(flattenTask), date });
    }

    // Pano hangi gün için açılırsa (bugün, ileri veya geri gezilen bir gün)
    // o gün için henüz türetilmemiş aktif "her gün" şablonları varsa burada
    // oluşturulur (cron gerektirmez).
    await ensureRecurringTasksForDate(projectId, date);

    // FIXED (sabit) görevler tarihten bağımsız her gün gösterilir; DATED
    // (tarih bazlı) görevler yalnızca kendi scheduledDate'iyle eşleşen günde.
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        AND: [
          { OR: [{ kind: "FIXED" }, { kind: "DATED", scheduledDate: toDateOrUndefined(date) }] },
          ...(visibilityWhere ? [visibilityWhere] : []),
        ],
      },
      include: taskInclude,
      orderBy: [{ columnId: "asc" }, { position: "asc" }],
    });

    return NextResponse.json({ tasks: tasks.map(flattenTask), date });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    const { project } = await requireProjectAccess(projectId, session.user.id);

    const body = await req.json();
    const data = createTaskSchema.parse(body);

    let columnId = data.columnId;
    if (!columnId) {
      const firstColumn = await prisma.taskColumn.findFirst({
        where: { projectId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      if (!firstColumn) {
        return NextResponse.json(
          { error: "Bu projede henüz sütun yok." },
          { status: 400 },
        );
      }
      columnId = firstColumn.id;
    }

    // Sabit (FIXED) projelerde her görev tarihten bağımsızdır — istemciden
    // gelen kind/scheduledDate yok sayılır, her zaman FIXED zorlanır. Tarih
    // bazlı (DATED) projelerde mevcut davranış aynen sürer: görev bazında
    // "Tarih Bazlı"/"Sabit" seçilebilir (bkz. task-modal.tsx).
    const kind = project.kind === "FIXED" ? "FIXED" : (data.kind ?? "DATED");
    const scheduledDate =
      kind === "FIXED"
        ? undefined
        : (toDateOrUndefined(data.scheduledDate) ?? toDateOrUndefined(todayIso())!);

    const last = await prisma.task.findFirst({
      where: { projectId, columnId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    // Görev #196: bir görev birden fazla kişiye atanabilir — istemciden
    // gelen assigneeIds listesi doğrudan task_assignees'e yazılır.
    const assigneeIds = Array.from(new Set(data.assigneeIds ?? []));

    const task = await prisma.task.create({
      data: {
        projectId,
        columnId,
        title: data.title,
        description: data.description ?? undefined,
        // Görev #318: bodyJson deseniyle aynı — dolu ise okuma modu render
        // eder, NULL/undefined ise eski düz metin görev (bkz. schema.prisma).
        // (Yeni görev oluştururken descriptionJson pratikte hep dolu ya da
        // hiç gönderilmiyor; yine de Prisma'nın InputJsonValue tipiyle
        // uyumlu olması için unknown'dan açıkça cast edilir.)
        descriptionJson:
          data.descriptionJson === undefined || data.descriptionJson === null
            ? undefined
            : (data.descriptionJson as Prisma.InputJsonValue),
        priority: data.priority ?? "MEDIUM",
        kind,
        scheduledDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        creatorId: session.user.id,
        position: (last?.position ?? -1) + 1,
        assignees: assigneeIds.length > 0 ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
      },
      include: taskInclude,
    });

    await logActivity({
      teamId: project.teamId,
      projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "TASK_CREATED",
      message: `"${task.title}" görevi oluşturuldu.`,
      module: "TASKS",
      ipAddress: getClientIp(req),
    });

    for (const userId of assigneeIds) {
      if (userId === session.user.id) continue;
      await notifyUser({
        userId,
        type: "TASK_ASSIGNED",
        title: "Yeni görev atandı",
        message: `"${task.title}" görevi size atandı.`,
        link: `/teams/${project.teamId}/projects/${projectId}`,
      });
    }

    return NextResponse.json({ task: flattenTask(task) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
