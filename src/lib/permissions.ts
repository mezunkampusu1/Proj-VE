import { prisma } from "@/lib/prisma";
import type { TeamRole } from "@prisma/client";

/**
 * Bir kullanıcının belirli bir takımdaki üyeliğini döner.
 * Üye değilse null döner.
 */
export async function getTeamMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function requireTeamMember(teamId: string, userId: string) {
  const membership = await getTeamMembership(teamId, userId);
  if (!membership) {
    throw new PermissionError("Bu takıma erişim yetkiniz yok.");
  }
  return membership;
}

export async function requireTeamAdmin(teamId: string, userId: string) {
  const membership = await requireTeamMember(teamId, userId);
  if (membership.role !== ("ADMIN" as TeamRole)) {
    throw new PermissionError("Bu işlem için takım yöneticisi olmanız gerekir.");
  }
  return membership;
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Kullanıcı talebi #6 (netleştirilmiş) proje görünürlük kuralının TEK
 * kaynağı — hem `GET /api/teams/[teamId]/projects` (API üzerinden liste)
 * hem de `teams/[teamId]/page.tsx` (server component, projeleri DOĞRUDAN
 * prisma ile çekiyor, API route'u hiç çağırmıyor) burayı kullanmalı.
 * Bunu iki ayrı yerde elle kopyalamak tam da "proje kartı listede hâlâ
 * görünüyor ama açınca yetkiniz yok diyor" hatasına yol açtı — sayfa kendi
 * sorgusunu yazmış, filtre yalnızca API route'a eklenmişti. Admin için `{}`
 * (filtresiz), `creatorId` NULL olan (migration öncesi) projeler için de
 * her zaman görünür kalır (geriye dönük uyumluluk).
 */
export function projectVisibilityWhere(role: TeamRole, userId: string) {
  if (role === ("ADMIN" as TeamRole)) return {};
  return {
    OR: [
      { creatorId: null },
      { creatorId: userId },
      { members: { some: { userId } } },
    ],
  };
}

/**
 * projectId üzerinden takım kimliğini bulup üyelik kontrolü yapar.
 *
 * Kullanıcı talebi #6 (netleştirilmiş): proje oluşturulurken kimler
 * etiketlenecek sorulur (bkz. create-project-form.tsx, POST
 * /api/teams/[teamId]/projects). Etiketlenen biri varsa yalnızca oluşturan +
 * etiketlenenler + admin erişebilir — bu kontrol yalnızca proje listesinde
 * değil, doğrudan proje URL'sine erişimde de (görevler, sütunlar, tekrarlayan
 * şablonlar vb. bu fonksiyonu kullanan HER uç nokta) uygulanır. `creatorId`
 * NULL olan (migration öncesi) projeler geriye dönük uyumluluk için herkese
 * açık kalır.
 */
export async function requireProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      teamId: true,
      kind: true,
      creatorId: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) {
    throw new NotFoundError("Proje bulunamadı.");
  }
  const membership = await requireTeamMember(project.teamId, userId);

  if (membership.role !== ("ADMIN" as TeamRole) && project.creatorId) {
    const isCreator = project.creatorId === userId;
    const isMember = project.members.some((m: { userId: string }) => m.userId === userId);
    if (!isCreator && !isMember) {
      throw new PermissionError("Bu projeye erişim yetkiniz yok.");
    }
  }

  return { project, membership };
}

/**
 * Görev görünürlüğünün TEK kaynağı — `GET /api/projects/[projectId]/tasks`,
 * `teams/[teamId]/projects/[projectId]/page.tsx` (SSR) ve
 * `requireTaskAccess` (tek görev doğrudan erişimi) burayı kullanır.
 *
 * Kullanıcı bildirdi: "proje oluştururken etiketlememe rağmen karşı taraf
 * proje içindeki görevleri göremiyor". Kök neden: proje seviyesinde kişi
 * etiketleme (bkz. create-project-form.tsx: "Seçilen kişiler bu projeyi
 * görüp İÇİNDE ÇALIŞABİLİR") yalnızca projenin KENDİSİNE erişim veriyordu;
 * projeye giren kişi, panodaki her görevi AYRICA o görevde de atanmış
 * olması gerektiği eski kuralla (bkz. kullanıcı talebi #6/#262) karşılaşıp
 * boş pano görüyordu. Artık: proje seviyesinde etiketleme AKTİFSE
 * (`creatorId` dolu — requireProjectAccess zaten bu kullanıcının oluşturan/
 * üye olduğunu doğrulamıştır), projeye erişimi olan biri o projedeki TÜM
 * görevleri görür — görev bazlı atama (assignees) artık yalnızca BİLDİRİM
 * hedefini belirler, görünürlüğü değil. Proje hiç etiketlenmemişse
 * (`creatorId` NULL, migration öncesi "açık" proje) eski görev-bazlı kural
 * (oluşturan + atananlar) geçerliliğini korur.
 */
export function taskVisibilityWhere(
  project: { creatorId: string | null },
  role: TeamRole,
  userId: string,
) {
  if (role === ("ADMIN" as TeamRole)) return undefined;
  if (project.creatorId) return undefined;
  return {
    OR: [{ creatorId: userId }, { assignees: { some: { userId } } }],
  };
}

/**
 * Kullanıcı talebi #6 (netleştirilmiş): "kişiyi etiketlemememe rağmen görevi
 * görebiliyor" bildirimi — kanban panosundaki liste uç noktası
 * (`GET /api/projects/[projectId]/tasks`) görünürlüğü zaten `visibilityWhere`
 * ile filtreliyordu, AMA tek bir görevi DOĞRUDAN kimliğiyle çeken her uç
 * nokta (GET/PATCH/DELETE tek görev, yorumlar, ekler, alt görevler,
 * etiketler...) yalnızca takım üyeliğine bakıyordu — panoda görünmese bile
 * ID'yi bilen/erişen herhangi bir takım üyesi görevin TÜM detayına
 * ulaşabiliyordu. Bu fonksiyon artık `taskVisibilityWhere` ile AYNI kuralı
 * (proje etiketliyse proje üyeliği yeterli; değilse oluşturan+atananlar)
 * burada da uyguluyor.
 */
export async function requireTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { id: true, teamId: true, creatorId: true, members: { select: { userId: true } } },
      },
      assignees: { select: { userId: true } },
    },
  });
  if (!task) {
    throw new NotFoundError("Görev bulunamadı.");
  }
  const membership = await requireTeamMember(task.project.teamId, userId);

  if (membership.role !== ("ADMIN" as TeamRole)) {
    if (task.project.creatorId) {
      // Proje seviyesinde etiketleme aktif — proje sahibi/üyesi ise
      // projedeki her görevi görebilir.
      const isProjectCreator = task.project.creatorId === userId;
      const isProjectMember = task.project.members.some((m: { userId: string }) => m.userId === userId);
      if (!isProjectCreator && !isProjectMember) {
        throw new PermissionError("Bu göreve erişim yetkiniz yok.");
      }
    } else {
      // Proje hiç etiketlenmemiş (açık proje) — eski görev-bazlı kural.
      const isCreator = task.creatorId === userId;
      const isAssignee = task.assignees.some((a: { userId: string }) => a.userId === userId);
      if (!isCreator && !isAssignee) {
        throw new PermissionError("Bu göreve erişim yetkiniz yok.");
      }
    }
  }

  return { task, membership };
}

/**
 * columnId üzerinden proje/takım kimliğini bulup üyelik kontrolü yapar.
 * Sütun (TaskColumn) işlemleri (yeniden adlandırma, silme, üzerinde görev
 * oluşturma) için requireProjectAccess ile aynı desen.
 */
export async function requireColumnAccess(columnId: string, userId: string) {
  const column = await prisma.taskColumn.findUnique({
    where: { id: columnId },
    include: { project: { select: { id: true, teamId: true } } },
  });
  if (!column) {
    throw new NotFoundError("Sütun bulunamadı.");
  }
  const membership = await requireTeamMember(column.project.teamId, userId);
  return { column, membership };
}

export async function requireRecurringTemplateAccess(templateId: string, userId: string) {
  const template = await prisma.recurringTaskTemplate.findUnique({
    where: { id: templateId },
    include: { project: { select: { id: true, teamId: true } } },
  });
  if (!template) {
    throw new NotFoundError("Tekrarlayan görev şablonu bulunamadı.");
  }
  const membership = await requireTeamMember(template.project.teamId, userId);
  return { template, membership };
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
