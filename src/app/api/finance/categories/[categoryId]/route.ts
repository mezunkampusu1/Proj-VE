import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFinanceCategorySchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveFinancePermissions, assertPermission } from "@/lib/finance-permissions";

interface Params {
  params: Promise<{ categoryId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { categoryId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canManageCategories, "Kategori yönetme yetkiniz yok.");

    const existing = await prisma.financeCategory.findUnique({ where: { id: categoryId } });
    if (!existing) throw new NotFoundError("Kategori bulunamadı.");

    const body = await req.json();
    const data = updateFinanceCategorySchema.parse(body);

    const category = await prisma.financeCategory.update({
      where: { id: categoryId },
      data: {
        name: data.name?.trim(),
        isActive: data.isActive,
        parentCategoryId: data.parentCategoryId === undefined ? undefined : data.parentCategoryId || null,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_CATEGORY_UPDATED",
      module: "FINANCE",
      message: `"${category.name}" finans kategorisi güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Bir kategori kullanılmış kayıtlar varsa SİLİNMEZ (referans bütünlüğü
 * `onDelete: Restrict` ile veritabanı seviyesinde de garanti altına
 * alınmıştır) — bunun yerine pasife alınması önerilir. Hiç kullanılmamışsa
 * doğrudan silinebilir.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { categoryId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canManageCategories, "Kategori yönetme yetkiniz yok.");

    const existing = await prisma.financeCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { transactions: true, subCategories: true } } },
    });
    if (!existing) throw new NotFoundError("Kategori bulunamadı.");

    if (existing._count.transactions > 0 || existing._count.subCategories > 0) {
      return NextResponse.json(
        { error: "Bu kategoriye bağlı kayıt veya alt kategori var — önce pasife alın." },
        { status: 409 },
      );
    }

    await prisma.financeCategory.delete({ where: { id: categoryId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_CATEGORY_DELETED",
      module: "FINANCE",
      message: `"${existing.name}" finans kategorisi silindi.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
