import { prisma } from "@/lib/prisma";

const WORKSPACE_NAME = "Mezun Kampüsü";

/**
 * Sistem tek bir çalışma alanı (workspace) olarak çalışır — çoklu takım
 * desteği veri modelinde durur (bkz. docs/ARCHITECTURE.md §1) ama ürün
 * yüzeyinde kullanıcıya asla bir takım seçtirilmez veya oluşturtulmaz.
 *
 * Bu fonksiyon:
 * - Sistemde hiç takım yoksa, çağıran kullanıcıyı Yönetici (ADMIN) yaparak
 *   tek workspace takımını oluşturur.
 * - Takım zaten varsa (en eski takım esas alınır) ve kullanıcı üyesi
 *   değilse, kullanıcıyı Ekip Üyesi (MEMBER) olarak otomatik ekler.
 * - Kullanıcı zaten üyeyse mevcut üyeliği döner.
 */
export async function getOrCreateWorkspaceTeam(userId: string) {
  const existingMembership = await prisma.teamMember.findFirst({
    where: { userId },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });
  if (existingMembership) return existingMembership.team;

  const primaryTeam = await prisma.team.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (primaryTeam) {
    await prisma.teamMember.create({
      data: { teamId: primaryTeam.id, userId, role: "MEMBER" },
    });
    return primaryTeam;
  }

  const slug = `workspace-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.team.create({
    data: {
      name: WORKSPACE_NAME,
      slug,
      members: { create: { userId, role: "ADMIN" } },
    },
  });
}
