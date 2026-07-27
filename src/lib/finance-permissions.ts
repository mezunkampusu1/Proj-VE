import { prisma } from "@/lib/prisma";
import { PermissionError } from "@/lib/permissions";
import type { TeamRole } from "@prisma/client";

/**
 * Finans modülünün ince taneli yetkileri (bkz. proje talebi §5). Bu,
 * İKİNCİ bir rol sistemi DEĞİLDİR — TeamRole (ADMIN/MEMBER) hâlâ tek
 * yetki otoritesidir: ADMIN her zaman tüm yetkilere sahiptir ve
 * FinancePermission tablosundan bağımsızdır. Bu tablo yalnızca MEMBER
 * rolündeki kullanıcılara istisnai ek yetki tanımlamak için vardır —
 * satır yoksa aşağıdaki MEMBER_DEFAULTS geçerli olur.
 */
export interface FinancePermissionSet {
  canViewFinance: boolean;
  canViewOwnRecords: boolean;
  canViewAllRecords: boolean;
  canCreateRecords: boolean;
  canEditOwnRecords: boolean;
  canEditAllRecords: boolean;
  canDeleteRecords: boolean;
  canViewReports: boolean;
  canViewAttachments: boolean;
  canManageCategories: boolean;
  canManageRates: boolean;
}

const ADMIN_PERMISSIONS: FinancePermissionSet = {
  canViewFinance: true,
  canViewOwnRecords: true,
  canViewAllRecords: true,
  canCreateRecords: true,
  canEditOwnRecords: true,
  canEditAllRecords: true,
  canDeleteRecords: true,
  canViewReports: true,
  canViewAttachments: true,
  canManageCategories: true,
  canManageRates: true,
};

/** Satır yoksa uygulanan makul MEMBER varsayılanları. */
export const MEMBER_DEFAULTS: FinancePermissionSet = {
  canViewFinance: true,
  canViewOwnRecords: true,
  canViewAllRecords: false,
  canCreateRecords: true,
  canEditOwnRecords: true,
  canEditAllRecords: false,
  canDeleteRecords: false,
  canViewReports: true,
  canViewAttachments: true,
  canManageCategories: false,
  canManageRates: false,
};

/** Bir kullanıcının finans yetki setini çözer (ADMIN kısayolu + override). */
export async function resolveFinancePermissions(
  userId: string,
  role: TeamRole,
): Promise<FinancePermissionSet> {
  if (role === "ADMIN") return ADMIN_PERMISSIONS;

  const override = await prisma.financePermission.findUnique({ where: { userId } });
  if (!override) return MEMBER_DEFAULTS;

  return {
    canViewFinance: override.canViewFinance,
    canViewOwnRecords: override.canViewOwnRecords,
    canViewAllRecords: override.canViewAllRecords,
    canCreateRecords: override.canCreateRecords,
    canEditOwnRecords: override.canEditOwnRecords,
    canEditAllRecords: override.canEditAllRecords,
    canDeleteRecords: override.canDeleteRecords,
    canViewReports: override.canViewReports,
    canViewAttachments: override.canViewAttachments,
    canManageCategories: override.canManageCategories,
    canManageRates: override.canManageRates,
  };
}

export function assertPermission(condition: boolean, message: string) {
  if (!condition) throw new PermissionError(message);
}

/**
 * Bir finans kaydını GÖREBİLİR mi? `canViewAllRecords` her zaman en geniş
 * yetkidir. Aksi halde kayıt üzerindeki `visibility` alanına göre karar
 * verilir (bkz. proje talebi §5 — örnekler: maaş kaydı sadece adminler,
 * ofis harcaması kullanıcı+admin, genel reklam gideri ilgili ekip).
 */
export function canViewTransaction(
  record: {
    createdById: string;
    personId: string;
    visibility: string;
    departmentId: string | null;
    visibleUsers?: { userId: string }[];
  },
  userId: string,
  role: TeamRole,
  permissions: FinancePermissionSet,
  userDepartmentId: string | null,
): boolean {
  if (role === "ADMIN" || permissions.canViewAllRecords) return true;

  switch (record.visibility) {
    case "ADMIN_ONLY":
      return false;
    case "OWNER_AND_ADMIN":
      return record.createdById === userId || record.personId === userId;
    case "SPECIFIC_USERS":
      return (
        record.createdById === userId ||
        record.personId === userId ||
        (record.visibleUsers ?? []).some((v) => v.userId === userId)
      );
    case "DEPARTMENT":
      return (
        record.createdById === userId ||
        record.personId === userId ||
        (!!userDepartmentId && userDepartmentId === record.departmentId)
      );
    case "TEAM":
      return true;
    default:
      return false;
  }
}

/**
 * Prisma `findMany` where filtresi için görünürlük koşulu üretir —
 * `canViewTransaction` ile birebir aynı kuralları DB seviyesinde uygular
 * (liste/rapor sorgularının tamamını client tarafında post-filter etmek
 * yerine, sunucu tarafında zaten kısıtlı bir sonuç döner — bkz. proje
 * talebi §12: "API ve sunucu tarafında da yetkisiz erişim engellensin").
 */
export function financeVisibilityWhere(
  userId: string,
  role: TeamRole,
  permissions: FinancePermissionSet,
  userDepartmentId: string | null,
) {
  if (role === "ADMIN" || permissions.canViewAllRecords) return {};

  const ownerOr = [{ createdById: userId }, { personId: userId }];

  return {
    OR: [
      { visibility: "OWNER_AND_ADMIN" as const, OR: ownerOr },
      {
        visibility: "SPECIFIC_USERS" as const,
        OR: [...ownerOr, { visibleUsers: { some: { userId } } }],
      },
      {
        visibility: "DEPARTMENT" as const,
        OR: userDepartmentId
          ? [...ownerOr, { departmentId: userDepartmentId }]
          : ownerOr,
      },
      { visibility: "TEAM" as const },
    ],
  };
}
