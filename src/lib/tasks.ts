import { prisma } from "@/lib/prisma";
import { toDateOrUndefined } from "@/lib/dates";
import { notifyUser } from "@/lib/activity";

/**
 * Yeni bir proje oluşturulduğunda otomatik açılan varsayılan sütun seti —
 * eski sabit TaskStatus enum'unun (TODO/IN_PROGRESS/IN_REVIEW/DONE) birebir
 * karşılığı, ama artık proje sahipleri bunları serbestçe
 * ekleyip/çıkarabilir/yeniden adlandırabilir (bkz. migration
 * 20260712200000_tasks_columns_scheduled_date_recurring, mevcut projeler
 * için aynı set orada uygulandı).
 */
const DEFAULT_COLUMNS = [
  { name: "Yapılacak", order: 0, isDoneColumn: false },
  { name: "Devam Ediyor", order: 1, isDoneColumn: false },
  { name: "Kontrol Edilecek", order: 2, isDoneColumn: false },
  { name: "Tamamlandı", order: 3, isDoneColumn: true },
];

export async function createDefaultColumns(projectId: string) {
  await prisma.taskColumn.createMany({
    data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId })),
  });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Her gün" olarak işaretlenen aktif RecurringTaskTemplate'leri tarar ve
 * GÖRÜNTÜLENEN gün için henüz türetilmemiş olanlardan yeni birer Task
 * satırı oluşturur. Cron GEREKTİRMEZ — pano hangi gün için açılırsa
 * (GET /api/projects/[id]/tasks?date=...) o gün için çağrılır; sadece
 * "bugün" değil, ileri veya geri gezilen herhangi bir gün için de çalışır
 * ki kullanıcı takvimde ileri bir güne baktığında tekrarlayan görev orada
 * zaten hazır dursun. `[recurringTemplateId, scheduledDate]` tekilliği aynı
 * şablonun aynı gün için iki kez türetilmesini veritabanı seviyesinde de
 * engeller.
 *
 * Yeni türeyen görev, o sütundaki en düşük `position`den bir eksiğiyle
 * oluşturulur — böylece sütunun EN BAŞINDA görünür (kullanıcı isteği:
 * tekrarlayan görev her gün en başta olsun).
 *
 * Şablonun atananları varsa (bkz. RecurringTemplateAssignee — kullanıcı
 * talebi #11: "görev içerisinde etiket"), her yeni türeyen görev için o
 * kişilere bildirim gönderilir — `[recurringTemplateId, scheduledDate]`
 * tekilliği aynı gün için ikinci kez tetiklenmesini zaten engellediğinden
 * kişi günde en fazla bir kez bu bildirimi alır.
 */
export async function ensureRecurringTasksForDate(projectId: string, dateIso?: string) {
  const targetDate = toDateOrUndefined(dateIso ?? todayIso())!;

  // Kullanıcı talebi #12: "her gün oluşturduğumuzda geri dönük tarihleri
  // değil o gün ve sonraki tarihlere görev oluştursun" — pano geriye
  // gezildiğinde (geçmiş bir gün görüntülendiğinde) bu fonksiyon o geçmiş
  // gün için de tekrarlayan görev türetiyordu (şablon o tarihte henüz var
  // olmasa bile), bu da geçmişi yapay olarak dolduruyordu. Artık yalnızca
  // bugün ve ileri tarihler için türetme yapılır; geçmiş günler o an
  // gerçekten var olan kayıtlarla, salt görüntülenerek gösterilir.
  if (targetDate.getTime() < toDateOrUndefined(todayIso())!.getTime()) {
    return;
  }

  const templates = await prisma.recurringTaskTemplate.findMany({
    where: { projectId, active: true },
    include: { assignees: { select: { userId: true } } },
  });
  if (templates.length === 0) return;

  let teamId: string | undefined;

  for (const tpl of templates) {
    const alreadyGenerated = await prisma.task.findUnique({
      where: {
        recurringTemplateId_scheduledDate: {
          recurringTemplateId: tpl.id,
          scheduledDate: targetDate,
        },
      },
      select: { id: true },
    });
    if (alreadyGenerated) continue;

    const first = await prisma.task.findFirst({
      where: { projectId, columnId: tpl.columnId },
      orderBy: { position: "asc" },
      select: { position: true },
    });

    // Kullanıcı talebi #11: şablon artık çoklu kişi etiketlemeyi destekliyor
    // (RecurringTemplateAssignee). Migration'dan önce oluşturulmuş eski
    // şablonlar için (henüz yeniden düzenlenmemişse) eski tekli `assigneeId`
    // alanına geriye dönük olarak düşülür.
    const assigneeIds =
      tpl.assignees.length > 0
        ? tpl.assignees.map((a) => a.userId)
        : tpl.assigneeId
          ? [tpl.assigneeId]
          : [];

    await prisma.task.create({
      data: {
        projectId,
        columnId: tpl.columnId,
        title: tpl.title,
        description: tpl.description ?? undefined,
        priority: tpl.priority,
        creatorId: tpl.createdById,
        scheduledDate: targetDate,
        recurringTemplateId: tpl.id,
        position: (first?.position ?? 0) - 1,
        assignees: assigneeIds.length > 0 ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
      },
    });

    for (const userId of assigneeIds) {
      if (teamId === undefined) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { teamId: true },
        });
        teamId = project?.teamId;
      }
      await notifyUser({
        userId,
        type: "TASK_ASSIGNED",
        title: "Bugünün tekrarlayan görevi hazır",
        message: `"${tpl.title}" her gün tekrarlayan görevi bugün için oluşturuldu.`,
        link: teamId ? `/teams/${teamId}/projects/${projectId}` : undefined,
      });
    }
  }
}

/**
 * Yorum/not metninden `@[Görünen Ad](userId)` biçimindeki etiketleme
 * belirteçlerini ayıklar. Bu biçim istemcideki @mention otomatik tamamlama
 * bileşeni tarafından üretilir (bkz. src/components/kanban/mention-textarea.tsx)
 * — kullanıcıların ad/e-posta çakışması ihtimaline karşı kimlik doğrudan
 * metne gömülür, ada göre belirsiz eşleştirme yapılmaz.
 */
export function extractMentionedUserIds(body: string): string[] {
  const matches = body.matchAll(/@\[[^\]]+\]\(([a-zA-Z0-9_-]+)\)/g);
  const ids = new Set<string>();
  for (const m of matches) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

/** Render için: `@[Ad](id)` belirtecini okunabilir `@Ad` metnine çevirir. */
export function renderMentionsAsPlainText(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([a-zA-Z0-9_-]+\)/g, "@$1");
}
