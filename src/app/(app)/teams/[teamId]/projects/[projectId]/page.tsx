import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamMembership, taskVisibilityWhere as computeTaskVisibilityWhere } from "@/lib/permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { AiSummaryButton } from "@/components/projects/ai-summary-modal";
import { EditProjectMembersButton } from "@/components/projects/edit-project-members-button";
import { ensureRecurringTasksForDate } from "@/lib/tasks";
import type { TaskWithRelations } from "@/components/kanban/types";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; projectId: string }>;
}) {
  const { teamId, projectId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const membership = await getTeamMembership(teamId, userId);
  if (!membership) notFound();

  const today = todayIso();
  const isAdmin = membership.role === "ADMIN";

  // Proje "Sabit" mi "Tarih Bazlı" mı önce belirlenir — buna göre görev
  // sorgusu ve "her gün" şablon taraması tamamen farklılaşır (bkz.
  // create-project-form.tsx'teki Pano Türü seçimi). Aynı sorguda
  // creatorId/members de çekiliyor — kullanıcı talebi #6 (netleştirilmiş):
  // bu sayfa projeleri/görevleri DOĞRUDAN prisma ile çekiyordu, API
  // route'larındaki (GET /api/teams/[teamId]/projects,
  // GET /api/projects/[projectId]/tasks) görünürlük filtreleri burada HİÇ
  // uygulanmıyordu — "kartta yetkiniz yok diyor ama panoda görünüyor" ve
  // "etiketlemediğim kişi görevi görebiliyor" hatalarıyla AYNI kök neden.
  // Artık requireProjectAccess/visibilityWhere ile AYNI kural burada da var.
  const projectMeta = await prisma.project.findUnique({
    where: { id: projectId, teamId },
    select: { kind: true, creatorId: true, members: { select: { userId: true } } },
  });
  if (!projectMeta) notFound();

  if (!isAdmin && projectMeta.creatorId) {
    const isCreator = projectMeta.creatorId === userId;
    const isProjectMember = projectMeta.members.some((m: { userId: string }) => m.userId === userId);
    if (!isCreator && !isProjectMember) notFound();
  }

  // Sabit (FIXED) projelerde gün/tarih kavramı yok — "her gün" şablon
  // taraması sadece Tarih Bazlı (DATED) projelerde anlamlıdır.
  if (projectMeta.kind === "DATED") {
    await ensureRecurringTasksForDate(projectId, today);
  }

  // Görev görünürlüğü: GET /api/projects/[projectId]/tasks'taki AYNI kural
  // (lib/permissions.ts → taskVisibilityWhere) — proje seviyesinde
  // etiketleme aktifse (creatorId dolu) projeye erişimi olan TÜM görevleri
  // görür; değilse oluşturan+atananlar kuralı geçerli.
  const taskVisibilityWhere = computeTaskVisibilityWhere(projectMeta, membership.role, userId);

  const project = await prisma.project.findUnique({
    where: { id: projectId, teamId },
    include: {
      columns: { orderBy: { order: "asc" } },
      tasks: {
        // FIXED projede tüm görevler; DATED projede FIXED (sabit) görevler
        // tarihten bağımsız her gün, DATED görevler yalnızca bugüne ait
        // olanlar gösterilir. Görünürlük filtresi (taskVisibilityWhere) her
        // iki dalda da AND ile eklenir.
        where: {
          AND: [
            projectMeta.kind === "FIXED"
              ? {}
              : {
                  OR: [
                    { kind: "FIXED" },
                    { kind: "DATED", scheduledDate: new Date(`${today}T00:00:00.000Z`) },
                  ],
                },
            ...(taskVisibilityWhere ? [taskVisibilityWhere] : []),
          ],
        },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
          creator: { select: { id: true, name: true, email: true, image: true } },
          subtasks: true,
          tags: { include: { tag: true } },
          // Görevlendirme #199/#201, revizyon #324: ilk sayfa yüklemesi de
          // API rotasıyla (projects/[projectId]/tasks/route.ts) aynı şekli
          // üretmeli — kart önizlemesi/rozetleri ve not rozeti F5 sonrası
          // değil, ilk açılışta da görünsün. Revizyon #327: "kartta göster"
          // işaretine bakılmaksızın TÜM ekler çekilir (her ek otomatik ikon
          // rozeti olur); `showOnCard` yalnızca kapak görselini belirler —
          // makul bir üst sınırla (30) çekilir.
          attachments: {
            orderBy: { createdAt: "asc" },
            take: 30,
            select: { id: true, kind: true, mimeType: true, externalUrl: true, showOnCard: true },
          },
          _count: { select: { comments: true } },
        },
        orderBy: [{ columnId: "asc" }, { position: "asc" }],
      },
      team: {
        select: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const members = project.team.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }));

  const columns = project.columns.map((c) => ({
    id: c.id,
    name: c.name,
    order: c.order,
    isDoneColumn: c.isDoneColumn,
  }));

  const tasks: TaskWithRelations[] = project.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    columnId: t.columnId,
    priority: t.priority,
    kind: t.kind,
    scheduledDate: t.scheduledDate ? t.scheduledDate.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    position: t.position,
    assignees: t.assignees.map((a) => a.user),
    creator: t.creator,
    subtasks: t.subtasks,
    tags: t.tags.map((tt) => tt.tag),
    recurringTemplateId: t.recurringTemplateId,
    cardImages: t.attachments,
    commentCount: t._count.comments,
  }));

  // Kullanıcı talebi: "kişiyi en baştan etiketlemedim ya da gruba sonradan
  // dahil oldu, sonradan etiketleyebileyim" — yalnızca oluşturan veya admin
  // görür/kullanır (backend PATCH /api/projects/[projectId] de AYNI kısıtı
  // tekrar doğruluyor).
  const canEditProjectMembers = isAdmin || projectMeta.creatorId === userId;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/teams/${teamId}`} className="hover:underline">
              {"< Projelendirmeye dön"}
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{project.name}</h1>
          {project.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEditProjectMembers && (
            <EditProjectMembersButton
              projectId={project.id}
              initialMemberIds={projectMeta.members.map((m: { userId: string }) => m.userId)}
            />
          )}
          <AiSummaryButton projectId={project.id} />
        </div>
      </div>

      <KanbanBoard
        projectId={project.id}
        projectKind={project.kind}
        initialTasks={tasks}
        initialColumns={columns}
        members={members}
      />
    </div>
  );
}
