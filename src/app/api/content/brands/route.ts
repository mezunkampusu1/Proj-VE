import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { resolveContentPermissions, assertContentPermission } from "@/lib/content-permissions";
import { slugify } from "@/lib/utils";
import { z } from "zod";

/**
 * ContentBrand — "Marka veya proje" filtre boyutu (bkz. proje talebi §2).
 * Basit bir referans tablosu; Department'tan KASITLI olarak ayrı tutulur
 * (bkz. prisma/schema.prisma açıklaması). Yönetimi admin'e aittir, ancak
 * herkes aktif markaları listeleyip içerik formunda seçebilir.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveContentPermissions(session.user.id, membership.role);
    assertContentPermission(permissions.canViewModule, "Bu modülü görüntüleme yetkiniz yok.");

    const showInactive = membership.role === "ADMIN";
    const brands = await prisma.contentBrand.findMany({
      where: showInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ brands });
  } catch (error) {
    return handleApiError(error);
  }
}

const createBrandSchema = z.object({
  name: z.string().min(1, "Marka adı gerekli").max(200),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    assertContentPermission(membership.role === "ADMIN", "Marka oluşturma yetkiniz yok.");

    const body = await req.json();
    const data = createBrandSchema.parse(body);
    const baseSlug = slugify(data.name) || "marka";
    let slug = baseSlug;
    let n = 1;
    while (await prisma.contentBrand.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`;
    }

    const brand = await prisma.contentBrand.create({ data: { name: data.name, slug } });
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
