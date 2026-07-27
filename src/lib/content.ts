import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/activity";
import { requireTeamMember, PermissionError, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { formatDate } from "@/lib/utils";
import {
  resolveContentPermissions,
  assertContentPermission,
  type ContentPermissionSet,
} from "@/lib/content-permissions";
import type { NotificationType, TeamRole } from "@prisma/client";

/**
 * Modül 10 — Sosyal Medya, İçerik ve SEO Yönetimi. Bu dosya, SocialContent/
 * BlogContent/SeoWork'ün ÜÇÜ arasında paylaşılan saf/tekrar kullanılabilir
 * mantığı barındırır (görünürlük, bildirim) — API route'ları veri erişimi +
 * yetki + kayıt-türüne-özgü alan doğrulamasını üstlenir. Revizyon #325: Site
 * İçi Çalışmalar (WebsiteWork) modülü komple kaldırıldığı için buradaki
 * paylaşılan mantıktan da çıkarıldı (Prisma modeli dokunulmadan kalır).
 */

/**
 * Bir içerik kaydının görünürlük kuralı — Finans modülündeki
 * `financeVisibilityWhere` ile AYNI fikir, ama Finans'ın tek bir
 * `visibility` enum alanı yerine burada üç ayrı yetki bayrağı (tümünü gör /
 * kendi + ilgili olduklarımı gör / departman içi gör) ve gerçek ilişki
 * alanları kullanılır:
 *
 * - `canViewAllContent` (veya ADMIN): hiçbir filtre yok, hepsini görür.
 * - `canViewOwnContent`: `creatorField` kendisiyse görür (kapatılabilir —
 *   örn. bir yöneticinin bilinçli olarak kısıtladığı bir hesap).
 * - Etiketlenen (`ContentMention`) veya isimli bir role atanmış (örn.
 *   tasarımcı/onaylayan) kullanıcı, `canViewOwnContent` kapalı olsa bile
 *   HER ZAMAN görür — bkz. proje talebi §11: "Etiketlenen kullanıcı ilgili
 *   kaydı görebilmeli" (TaskAssignee/DocumentMention/FileMention'daki AYNI
 *   kural, burada da istisnasız uygulanır).
 * - `canViewTeamContent`: oluşturanla AYNI departmandaki kullanıcılar da
 *   görür (Finans'ın DEPARTMENT görünürlüğüyle aynı `departments` tablosu
 *   kullanılır — ayrı bir "ekip" kavramı icat edilmez).
 */
export function contentVisibilityWhere(params: {
  userId: string;
  role: TeamRole;
  permissions: ContentPermissionSet;
  viewerDepartmentId: string | null;
  /** Kaydı oluşturan kullanıcının FK alan adı, örn. "createdById". */
  creatorField: string;
  /** Prisma modelindeki oluşturan ilişki adı (departman join'i için), örn. "createdBy". */
  creatorRelationField: string;
  /** Diğer isimli rol FK alanları, örn. ["designerId","videoEditorId","approvedById","publishedById"]. */
  roleFields?: string[];
  /** ContentMention[] ilişki alan adı, örn. "mentions". */
  mentionRelationField: string;
}) {
  const {
    userId,
    role,
    permissions,
    viewerDepartmentId,
    creatorField,
    creatorRelationField,
    roleFields = [],
    mentionRelationField,
  } = params;

  if (role === "ADMIN" || permissions.canViewAllContent) return {};

  const clauses: Record<string, unknown>[] = [];

  if (permissions.canViewOwnContent) {
    clauses.push({ [creatorField]: userId });
  }
  for (const field of roleFields) {
    clauses.push({ [field]: userId });
  }
  clauses.push({ [mentionRelationField]: { some: { userId } } });

  if (permissions.canViewTeamContent && viewerDepartmentId) {
    clauses.push({ [creatorRelationField]: { departmentId: viewerDepartmentId } });
  }

  return { OR: clauses };
}

/**
 * Bir içerik/kalem üzerinde çalışan ilişkili kullanıcıların (oluşturan +
 * isimli roller + etiketlenenler) id listesini, tekrarsız ve `excludeUserId`
 * hariç olarak döner — bildirim gönderilecek hedef kitleyi belirlemek için
 * kullanılır (bkz. proje talebi §15).
 */
export function relatedUserIds(input: {
  creatorId?: string | null;
  roleUserIds?: (string | null | undefined)[];
  mentionedUserIds?: string[];
  excludeUserId?: string;
}): string[] {
  const ids = new Set<string>();
  if (input.creatorId) ids.add(input.creatorId);
  for (const id of input.roleUserIds ?? []) {
    if (id) ids.add(id);
  }
  for (const id of input.mentionedUserIds ?? []) {
    ids.add(id);
  }
  if (input.excludeUserId) ids.delete(input.excludeUserId);
  return Array.from(ids);
}

/**
 * Belirli bir yetki bayrağı (örn. `canApproveContent`) açık olan tüm takım
 * üyelerine bildirim gönderir — `notifyAdminsForDailyFlowEvent` ile AYNI
 * "yayın" deseni, ama sabit ADMIN yerine ince taneli yetkiye göre hedef
 * kitle belirlenir (onay/planlama gibi işlemler admin olmayan bir üyeye de
 * delege edilebilir — bkz. proje talebi §14).
 */
export async function notifyUsersWithContentPermission(input: {
  teamId: string;
  permissionFlag: keyof ContentPermissionSet;
  excludeUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const members = await prisma.teamMember.findMany({
    where: {
      teamId: input.teamId,
      ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
    },
    select: { userId: true, role: true },
  });
  if (members.length === 0) return;

  const targets: string[] = [];
  for (const member of members) {
    const permissions = await resolveContentPermissions(member.userId, member.role);
    if (permissions[input.permissionFlag]) targets.push(member.userId);
  }

  await Promise.all(
    targets.map((userId) =>
      notifyUser({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      }),
    ),
  );
}

/**
 * Doğrudan belirli kullanıcı(lar)a bildirim gönderir — etiketlenme, atanma,
 * revizyon, onay/red gibi HEDEFİ NET olan olaylar için (bkz. proje talebi
 * §15). `notifyUsersWithContentPermission`'dan farkı: burada hedef kitle bir
 * yetkiye göre değil, olayın doğrudan taraflarına göre belirlenir.
 */
export async function notifyContentUsers(
  userIds: string[],
  input: {
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  },
) {
  await Promise.all(
    userIds.map((userId) =>
      notifyUser({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// SocialContent — erişim kontrolü + platforma göre dinamik içerik türü +
// durum geçiş kuralları (bkz. proje talebi §5, §6).
// ---------------------------------------------------------------------------

/**
 * Platforma göre geçerli içerik türleri — TEK kaynak (bkz. proje talebi §5:
 * "yeni platformlar eklenebilecek şekilde esnek"). `contentType` şema
 * seviyesinde bilinçli olarak serbest String'dir; geçerlilik burada
 * doğrulanır. `src/lib/utils.ts`'teki `socialContentTypesByPlatform` bu
 * listenin AYNI değerlerini kullanıcıya gösterilecek etiketlerle eşler —
 * biri değişirse diğeri de güncellenmeli.
 */
export const SOCIAL_CONTENT_TYPES_BY_PLATFORM: Record<string, string[]> = {
  INSTAGRAM: ["POST", "REELS", "STORY", "CAROUSEL", "LIVE_ANNOUNCEMENT"],
  LINKEDIN: [
    "TEXT_POST",
    "IMAGE_POST",
    "ARTICLE",
    "DOCUMENT",
    "VIDEO",
    "JOB_POST",
    "COMPANY_ANNOUNCEMENT",
  ],
  TWITTER: ["SINGLE_POST", "THREAD", "IMAGE_POST", "VIDEO", "POLL", "ANNOUNCEMENT"],
  TIKTOK: ["VIDEO", "SERIES", "EDUCATIONAL", "TREND", "INTERVIEW", "PROMO"],
  FACEBOOK: ["POST", "IMAGE", "VIDEO", "STORY", "EVENT", "LINK_SHARE"],
};

export function isValidSocialContentType(platform: string, contentType: string): boolean {
  return SOCIAL_CONTENT_TYPES_BY_PLATFORM[platform]?.includes(contentType) ?? false;
}

/**
 * 13 durumlu iş akışında, HANGİ hedef duruma geçmek özel bir yetki
 * gerektirir (bkz. proje talebi §6 — "durum geçişleri rol ve yetkilere göre
 * kontrol edilmeli"). Listelenmeyen durumlar (IDEA/DRAFT/IN_PROGRESS/
 * AWAITING_*) yalnızca genel düzenleme yetkisi gerektirir.
 */
const STATUS_PERMISSION_REQUIREMENTS: Partial<Record<string, keyof ContentPermissionSet>> = {
  APPROVED: "canApproveContent",
  PUBLISHED: "canMarkPublished",
  SCHEDULED: "canScheduleContent",
  REVISION_REQUESTED: "canRequestRevision",
};

/**
 * Bir durum geçişinin izinli olup olmadığını doğrular; değilse
 * `PermissionError` fırlatır. `canEditThisRecord`, çağıran route tarafından
 * zaten hesaplanmış olmalı (bkz. `canEditContentRecord`).
 */
export function assertCanSetContentStatus(
  permissions: ContentPermissionSet,
  canEditThisRecord: boolean,
  nextStatus: string,
) {
  const requiredFlag = STATUS_PERMISSION_REQUIREMENTS[nextStatus];
  if (requiredFlag) {
    assertContentPermission(
      permissions[requiredFlag],
      "Bu durum değişikliği için yetkiniz yok.",
    );
    return;
  }
  assertContentPermission(canEditThisRecord, "Bu içeriği düzenleme yetkiniz yok.");
}

/** Bir kullanıcının bir içerik kaydını düzenleyip düzenleyemeyeceği — silme dışındaki tüm PATCH işlemleri için ortak kural. */
export function canEditContentRecord(
  permissions: ContentPermissionSet,
  role: TeamRole,
  isCreator: boolean,
): boolean {
  if (role === "ADMIN" || permissions.canEditAllContent) return true;
  return isCreator && permissions.canEditOwnContent;
}

/** Bir kullanıcının bir içerik kaydını silip silemeyeceği (bkz. proje talebi §14 — silme yetkisi özellikle dikkatli tasarlanmalı). */
export function canDeleteContentRecord(
  permissions: ContentPermissionSet,
  role: TeamRole,
  isCreator: boolean,
): boolean {
  if (role === "ADMIN" || permissions.canDeleteAllContent) return true;
  return isCreator && permissions.canDeleteOwnContent;
}

type SocialContentWithRelations = Awaited<ReturnType<typeof loadSocialContentForAccess>>;

async function loadSocialContentForAccess(contentId: string) {
  return prisma.socialContent.findUnique({
    where: { id: contentId },
    include: {
      mentions: { select: { userId: true } },
      createdBy: { select: { id: true, departmentId: true } },
    },
  });
}

/**
 * socialContentId üzerinden erişim kontrolü — `requireProjectAccess` ile
 * aynı desen: kayıt + üyelik + yetki setini tek seferde döner, tek görevi
 * DOĞRUDAN kimliğiyle çeken her uç nokta (detay/güncelleme/silme/yorum/
 * dosya/revizyon) burayı kullanır (bkz. proje kuralı — "kimliği bilen her
 * takım üyesi göremesin" dersi, requireTaskAccess'teki AYNI ders).
 */
export async function requireSocialContentAccess(contentId: string, userId: string) {
  const content = await loadSocialContentForAccess(contentId);
  if (!content || content.deletedAt) {
    throw new NotFoundError("İçerik bulunamadı.");
  }

  const membership = await requireTeamMember(content.teamId, userId);
  const permissions = await resolveContentPermissions(userId, membership.role);

  if (membership.role !== "ADMIN" && !permissions.canViewAllContent) {
    const isOwn = permissions.canViewOwnContent && content.createdById === userId;
    const isNamedRole = [
      content.designerId,
      content.videoEditorId,
      content.approvedById,
      content.publishedById,
    ].includes(userId);
    const isMentioned = content.mentions.some((m) => m.userId === userId);
    let isSameDepartment = false;
    if (permissions.canViewTeamContent && content.createdBy.departmentId) {
      const viewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      isSameDepartment = viewer?.departmentId === content.createdBy.departmentId;
    }
    if (!isOwn && !isNamedRole && !isMentioned && !isSameDepartment) {
      throw new PermissionError("Bu içeriğe erişim yetkiniz yok.");
    }
  }

  return { content, membership, permissions };
}

// ---------------------------------------------------------------------------
// DailyWorkReport / DailyWorkItem — DailyFlowEntry ile AYNI desen: `teamId`
// taşımaz, ilgili takım sorgu anında `getOrCreateWorkspaceTeam(userId)` ile
// çözülür (bkz. proje talebi §4). Görünürlük SocialContent/Blog/Seo/Website'
// ten FARKLIDIR: departman/etiketleme yoktur — yalnızca "kendi raporun" veya
// "onay yetkin var (yönetici/admin)" ile görülür.
// ---------------------------------------------------------------------------

async function loadDailyWorkReportForAccess(id: string) {
  return prisma.dailyWorkReport.findUnique({
    where: { id },
    include: { items: { include: { mentions: { select: { userId: true } } } } },
  });
}

export async function requireDailyWorkReportAccess(reportId: string, userId: string) {
  const report = await loadDailyWorkReportForAccess(reportId);
  if (!report) {
    throw new NotFoundError("Günlük çalışma raporu bulunamadı.");
  }

  const workspace = await getOrCreateWorkspaceTeam(report.userId);
  const membership = await requireTeamMember(workspace.id, userId);
  const permissions = await resolveContentPermissions(userId, membership.role);

  const isOwner = report.userId === userId;
  const canReview = membership.role === "ADMIN" || permissions.canApproveDailyReport;
  if (!isOwner && !canReview) {
    throw new PermissionError("Bu günlük çalışma raporuna erişim yetkiniz yok.");
  }

  return { report, membership, permissions, isOwner, canReview, teamId: workspace.id };
}

/** Bir günlük çalışma raporunu onaylama/revizyona gönderme yetkisi var mı — bkz. proje talebi §4. */
export function canReviewDailyWorkReport(permissions: ContentPermissionSet, role: TeamRole): boolean {
  return role === "ADMIN" || permissions.canApproveDailyReport;
}

// ---------------------------------------------------------------------------
// Yorum / revizyon / dosya bağlama — SocialContent/BlogContent/SeoWork/
// DailyWorkReport'un DÖRDÜ arasında PAYLAŞILAN tablolar
// (ContentComment/ContentRevision/ContentAsset — bkz. proje talebi §12/§13).
// Veritabanı tarafı tip güvenli kalır (gerçek nullable FK sütunları); yalnızca
// bu dispatcher, URL'deki `kind` segmentine göre DOĞRU FK alanına ve DOĞRU
// erişim fonksiyonuna yönlendirir — böylece 5 ayrı route ağacında aynı
// yorum/revizyon/dosya mantığı TEKRAR yazılmaz (bkz. proje "single source of
// truth" kuralı).
// ---------------------------------------------------------------------------

export type ContentKind = "social" | "blog" | "seo" | "daily-report";

export const CONTENT_KIND_FK_FIELD: Record<ContentKind, string> = {
  social: "socialContentId",
  blog: "blogContentId",
  seo: "seoWorkId",
  "daily-report": "dailyWorkReportId",
};

/** Revizyon (`ContentRevision`) yalnızca 4 içerik türünde vardır — günlük raporun revizyonu `DailyWorkReportStatus` ile ayrı yönetilir (bkz. review/route.ts). */
export function isRevisionCapableKind(
  kind: ContentKind,
): kind is Exclude<ContentKind, "daily-report"> {
  return kind !== "daily-report";
}

export interface ContentTarget {
  teamId: string;
  fkField: string;
  permissions: ContentPermissionSet;
  membership: { role: TeamRole };
  isOwner: boolean;
  /** Oluşturan + isimli roller — yeni yorum/revizyon geldiğinde kimlere bildirim gideceğini belirler. */
  notifyTargets: string[];
}

/**
 * URL'deki `kind` segmentine göre doğru erişim fonksiyonunu çağırır ve tüm
 * kayıt türleri için ORTAK, normalize edilmiş bir sonuç döner — yorum/
 * revizyon/dosya route'ları kayıt türünü bilmeden bu sonucu kullanır.
 */
export async function resolveContentTarget(
  kind: ContentKind,
  contentId: string,
  userId: string,
): Promise<ContentTarget> {
  switch (kind) {
    case "social": {
      const { content, membership, permissions } = await requireSocialContentAccess(contentId, userId);
      return {
        teamId: content.teamId,
        fkField: CONTENT_KIND_FK_FIELD.social,
        permissions,
        membership,
        isOwner: content.createdById === userId,
        notifyTargets: relatedUserIds({
          creatorId: content.createdById,
          roleUserIds: [content.designerId, content.videoEditorId, content.approvedById, content.publishedById],
          excludeUserId: userId,
        }),
      };
    }
    case "blog": {
      const { content, membership, permissions } = await requireBlogContentAccess(contentId, userId);
      return {
        teamId: content.teamId,
        fkField: CONTENT_KIND_FK_FIELD.blog,
        permissions,
        membership,
        isOwner: content.createdById === userId,
        notifyTargets: relatedUserIds({
          creatorId: content.createdById,
          roleUserIds: [content.editorId, content.seoReviewedById, content.approvedById],
          excludeUserId: userId,
        }),
      };
    }
    case "seo": {
      const { content, membership, permissions } = await requireSeoWorkAccess(contentId, userId);
      return {
        teamId: content.teamId,
        fkField: CONTENT_KIND_FK_FIELD.seo,
        permissions,
        membership,
        isOwner: content.createdById === userId,
        notifyTargets: relatedUserIds({
          creatorId: content.createdById,
          roleUserIds: [content.assignedToId, content.approvedById],
          excludeUserId: userId,
        }),
      };
    }
    case "daily-report": {
      const { report, teamId, membership, permissions, isOwner } = await requireDailyWorkReportAccess(
        contentId,
        userId,
      );
      return {
        teamId,
        fkField: CONTENT_KIND_FK_FIELD["daily-report"],
        permissions,
        membership,
        isOwner,
        notifyTargets: relatedUserIds({
          creatorId: report.userId,
          roleUserIds: [report.reviewedById],
          excludeUserId: userId,
        }),
      };
    }
    default: {
      const _exhaustive: never = kind;
      throw new NotFoundError(`Bilinmeyen içerik türü: ${_exhaustive}`);
    }
  }
}

export type { SocialContentWithRelations };

// ---------------------------------------------------------------------------
// BlogContent / SeoWork — SocialContent ile AYNI erişim deseni,
// yalnızca isimli rol alanları farklı (bkz. proje talebi §8, §10). Tag
// modelindeki "polimorfik tek fonksiyon yerine tip güvenliği" tercihiyle
// tutarlı olarak, generic bir helper yerine üç ayrı fonksiyon yazılmıştır.
// ---------------------------------------------------------------------------

async function loadBlogContentForAccess(id: string) {
  return prisma.blogContent.findUnique({
    where: { id },
    include: {
      mentions: { select: { userId: true } },
      createdBy: { select: { id: true, departmentId: true } },
    },
  });
}

export async function requireBlogContentAccess(contentId: string, userId: string) {
  const content = await loadBlogContentForAccess(contentId);
  if (!content || content.deletedAt) {
    throw new NotFoundError("Blog içeriği bulunamadı.");
  }

  const membership = await requireTeamMember(content.teamId, userId);
  const permissions = await resolveContentPermissions(userId, membership.role);

  if (membership.role !== "ADMIN" && !permissions.canViewAllContent) {
    const isOwn = permissions.canViewOwnContent && content.createdById === userId;
    const isNamedRole = [content.editorId, content.seoReviewedById, content.approvedById].includes(
      userId,
    );
    const isMentioned = content.mentions.some((m) => m.userId === userId);
    let isSameDepartment = false;
    if (permissions.canViewTeamContent && content.createdBy.departmentId) {
      const viewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      isSameDepartment = viewer?.departmentId === content.createdBy.departmentId;
    }
    if (!isOwn && !isNamedRole && !isMentioned && !isSameDepartment) {
      throw new PermissionError("Bu blog içeriğine erişim yetkiniz yok.");
    }
  }

  return { content, membership, permissions };
}

async function loadSeoWorkForAccess(id: string) {
  return prisma.seoWork.findUnique({
    where: { id },
    include: {
      mentions: { select: { userId: true } },
      createdBy: { select: { id: true, departmentId: true } },
    },
  });
}

export async function requireSeoWorkAccess(workId: string, userId: string) {
  const content = await loadSeoWorkForAccess(workId);
  if (!content || content.deletedAt) {
    throw new NotFoundError("SEO çalışması bulunamadı.");
  }

  const membership = await requireTeamMember(content.teamId, userId);
  const permissions = await resolveContentPermissions(userId, membership.role);

  if (membership.role !== "ADMIN" && !permissions.canViewAllContent) {
    const isOwn = permissions.canViewOwnContent && content.createdById === userId;
    const isNamedRole = [content.assignedToId, content.approvedById].includes(userId);
    const isMentioned = content.mentions.some((m) => m.userId === userId);
    let isSameDepartment = false;
    if (permissions.canViewTeamContent && content.createdBy.departmentId) {
      const viewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      });
      isSameDepartment = viewer?.departmentId === content.createdBy.departmentId;
    }
    if (!isOwn && !isNamedRole && !isMentioned && !isSameDepartment) {
      throw new PermissionError("Bu SEO çalışmasına erişim yetkiniz yok.");
    }
  }

  return { content, membership, permissions };
}

// ---------------------------------------------------------------------------
// Yaklaşan yayın / son tarih hatırlatmaları — Finans modülündeki
// `generateDueFinanceTransactions`/`notifyDuePayments` ile AYNI desen: gerçek
// bir cron YOKTUR, bu fonksiyon modülün ana GET uç noktalarının başında
// çağrılır (bkz. proje kuralı — bkz. src/app/api/finance/transactions/
// route.ts). Aynı bildirimin bugün içinde tekrar gönderilmesini önlemek için
// `notifyOnceForContent` aynı kullanıcı+tür+link için bugünkü bir kayıt olup
// olmadığını kontrol eder.
// ---------------------------------------------------------------------------

async function notifyOnceForContent(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const existing = await prisma.notification.findFirst({
    where: { userId: params.userId, type: params.type, link: params.link, createdAt: { gte: todayStart } },
    select: { id: true },
  });
  if (existing) return;
  await notifyUser({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  });
}

/**
 * Bir takımın içerik modülünde yaklaşan yayınları (SCHEDULED durumda,
 * 24 saat içinde `scheduledAt`) ve yaklaşan son tarihleri (SeoWork,
 * terminal olmayan durumda, 2 gün içinde `dueDate`) tarar ve ilgili
 * kullanıcılara bildirim gönderir (bkz. proje talebi §15).
 */
export async function notifyContentDueReminders(teamId: string): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const terminalStatuses = ["PUBLISHED", "CANCELLED", "ARCHIVED"];

  const [socialDue, blogDue, seoDue] = await Promise.all([
    prisma.socialContent.findMany({
      where: { teamId, deletedAt: null, status: "SCHEDULED", scheduledAt: { gte: now, lte: in24h } },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        createdById: true,
        designerId: true,
        videoEditorId: true,
      },
    }),
    prisma.blogContent.findMany({
      where: { teamId, deletedAt: null, status: "SCHEDULED", scheduledAt: { gte: now, lte: in24h } },
      select: { id: true, title: true, scheduledAt: true, createdById: true, editorId: true },
    }),
    prisma.seoWork.findMany({
      where: {
        teamId,
        deletedAt: null,
        status: { notIn: terminalStatuses as never[] },
        dueDate: { gte: now, lte: in2Days },
      },
      select: { id: true, title: true, dueDate: true, createdById: true, assignedToId: true },
    }),
  ]);

  for (const c of socialDue) {
    const targets = relatedUserIds({ creatorId: c.createdById, roleUserIds: [c.designerId, c.videoEditorId] });
    for (const userId of targets) {
      await notifyOnceForContent({
        userId,
        type: "CONTENT_PUBLISH_REMINDER",
        title: "Yayın hatırlatması",
        message: `"${c.title}" içeriği ${formatDate(c.scheduledAt)} tarihinde yayınlanacak.`,
        link: "/content/social",
      });
    }
  }

  for (const c of blogDue) {
    const targets = relatedUserIds({ creatorId: c.createdById, roleUserIds: [c.editorId] });
    for (const userId of targets) {
      await notifyOnceForContent({
        userId,
        type: "CONTENT_PUBLISH_REMINDER",
        title: "Yayın hatırlatması",
        message: `"${c.title}" blog içeriği ${formatDate(c.scheduledAt)} tarihinde yayınlanacak.`,
        link: "/content/blog",
      });
    }
  }

  for (const w of seoDue) {
    const targets = relatedUserIds({ creatorId: w.createdById, roleUserIds: [w.assignedToId] });
    for (const userId of targets) {
      await notifyOnceForContent({
        userId,
        type: "CONTENT_DEADLINE_REMINDER",
        title: "Son tarih hatırlatması",
        message: `"${w.title}" SEO çalışmasının son tarihi ${formatDate(w.dueDate)}.`,
        link: "/content/seo",
      });
    }
  }
}
