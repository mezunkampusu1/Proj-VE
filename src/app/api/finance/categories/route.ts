import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFinanceCategorySchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { resolveFinancePermissions, assertPermission } from "@/lib/finance-permissions";
import { slugify } from "@/lib/utils";

/** Gider/gelir kategorileri — admin tarafından yönetilir (bkz. proje talebi §3). */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const includeInactive = searchParams.get("includeInactive") === "1";

    const categories = await prisma.financeCategory.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canManageCategories, "Kategori yönetme yetkiniz yok.");

    const body = await req.json();
    const data = createFinanceCategorySchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.financeCategory.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Bu isimde bir kategori zaten kayıtlı." }, { status: 409 });
    }

    if (data.parentCategoryId) {
      const parent = await prisma.financeCategory.findUnique({ where: { id: data.parentCategoryId } });
      if (!parent || parent.type !== data.type) {
        return NextResponse.json(
          { error: "Üst kategori bulunamadı veya türü uyuşmuyor." },
          { status: 400 },
        );
      }
    }

    const category = await prisma.financeCategory.create({
      data: {
        name: data.name.trim(),
        slug,
        type: data.type,
        parentCategoryId: data.parentCategoryId || undefined,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_CATEGORY_CREATED",
      module: "FINANCE",
      message: `"${category.name}" finans kategorisi eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
