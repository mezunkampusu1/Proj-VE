import { prisma } from "@/lib/prisma";
import { PermissionError } from "@/lib/permissions";
import type { TeamRole } from "@prisma/client";

/**
 * Sosyal Medya, İçerik ve SEO Yönetimi modülünün ince taneli yetkileri —
 * `lib/finance-permissions.ts` ile BİREBİR AYNI desen (bkz. proje talebi
 * §14: "Mevcut rol ve yetki sistemini kullan... ancak bu modül için detaylı
 * izinler tanımla"). Bu, İKİNCİ bir rol sistemi DEĞİLDİR — TeamRole
 * (ADMIN/MEMBER) hâlâ tek yetki otoritesidir: ADMIN her zaman tüm yetkilere
 * sahiptir ve ContentPermission tablosundan bağımsızdır. Bu tablo yalnızca
 * MEMBER rolündeki kullanıcılara istisnai ek/azaltılmış yetki tanımlamak
 * için vardır — satır yoksa aşağıdaki MEMBER_DEFAULTS geçerli olur.
 */
export interface ContentPermissionSet {
  canViewModule: boolean;
  canViewAllContent: boolean;
  canViewOwnContent: boolean;
  canViewTeamContent: boolean;
  canCreateContent: boolean;
  canEditOwnContent: boolean;
  canEditAllContent: boolean;
  canDeleteOwnContent: boolean;
  canDeleteAllContent: boolean;
  canApproveContent: boolean;
  canRequestRevision: boolean;
  canScheduleContent: boolean;
  canMarkPublished: boolean;
  canManageBlog: boolean;
  canManageSeo: boolean;
  canManageWebsiteWork: boolean;
  canCreateDailyReport: boolean;
  canApproveDailyReport: boolean;
  canUploadFiles: boolean;
  canDeleteFiles: boolean;
  canComment: boolean;
  canMentionUsers: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canUseAi: boolean;
  canViewAiCosts: boolean;
  canViewActivityLog: boolean;
}

const ADMIN_PERMISSIONS: ContentPermissionSet = {
  canViewModule: true,
  canViewAllContent: true,
  canViewOwnContent: true,
  canViewTeamContent: true,
  canCreateContent: true,
  canEditOwnContent: true,
  canEditAllContent: true,
  canDeleteOwnContent: true,
  canDeleteAllContent: true,
  canApproveContent: true,
  canRequestRevision: true,
  canScheduleContent: true,
  canMarkPublished: true,
  canManageBlog: true,
  canManageSeo: true,
  canManageWebsiteWork: true,
  canCreateDailyReport: true,
  canApproveDailyReport: true,
  canUploadFiles: true,
  canDeleteFiles: true,
  canComment: true,
  canMentionUsers: true,
  canViewReports: true,
  canManageSettings: true,
  canUseAi: true,
  canViewAiCosts: true,
  canViewActivityLog: true,
};

/** Satır yoksa uygulanan makul MEMBER varsayılanları (bkz. ContentPermission şema alan varsayılanları — aynı değerler). */
export const MEMBER_DEFAULTS: ContentPermissionSet = {
  canViewModule: true,
  canViewAllContent: false,
  canViewOwnContent: true,
  canViewTeamContent: false,
  canCreateContent: true,
  canEditOwnContent: true,
  canEditAllContent: false,
  canDeleteOwnContent: false,
  canDeleteAllContent: false,
  canApproveContent: false,
  canRequestRevision: false,
  canScheduleContent: false,
  canMarkPublished: false,
  canManageBlog: true,
  canManageSeo: true,
  canManageWebsiteWork: true,
  canCreateDailyReport: true,
  canApproveDailyReport: false,
  canUploadFiles: true,
  canDeleteFiles: false,
  canComment: true,
  canMentionUsers: true,
  canViewReports: true,
  canManageSettings: false,
  canUseAi: true,
  canViewAiCosts: false,
  canViewActivityLog: false,
};

/** Bir kullanıcının içerik modülü yetki setini çözer (ADMIN kısayolu + override). */
export async function resolveContentPermissions(
  userId: string,
  role: TeamRole,
): Promise<ContentPermissionSet> {
  if (role === "ADMIN") return ADMIN_PERMISSIONS;

  const override = await prisma.contentPermission.findUnique({ where: { userId } });
  if (!override) return MEMBER_DEFAULTS;

  return {
    canViewModule: override.canViewModule,
    canViewAllContent: override.canViewAllContent,
    canViewOwnContent: override.canViewOwnContent,
    canViewTeamContent: override.canViewTeamContent,
    canCreateContent: override.canCreateContent,
    canEditOwnContent: override.canEditOwnContent,
    canEditAllContent: override.canEditAllContent,
    canDeleteOwnContent: override.canDeleteOwnContent,
    canDeleteAllContent: override.canDeleteAllContent,
    canApproveContent: override.canApproveContent,
    canRequestRevision: override.canRequestRevision,
    canScheduleContent: override.canScheduleContent,
    canMarkPublished: override.canMarkPublished,
    canManageBlog: override.canManageBlog,
    canManageSeo: override.canManageSeo,
    canManageWebsiteWork: override.canManageWebsiteWork,
    canCreateDailyReport: override.canCreateDailyReport,
    canApproveDailyReport: override.canApproveDailyReport,
    canUploadFiles: override.canUploadFiles,
    canDeleteFiles: override.canDeleteFiles,
    canComment: override.canComment,
    canMentionUsers: override.canMentionUsers,
    canViewReports: override.canViewReports,
    canManageSettings: override.canManageSettings,
    canUseAi: override.canUseAi,
    canViewAiCosts: override.canViewAiCosts,
    canViewActivityLog: override.canViewActivityLog,
  };
}

export function assertContentPermission(condition: boolean, message: string) {
  if (!condition) throw new PermissionError(message);
}
