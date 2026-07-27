import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const createDepartmentSchema = z.object({ name: z.string().min(1, "Departman adı gerekli").max(80) });

/**
 * Minimal kullanıcı gruplama etiketi — yalnızca finans kayıtlarındaki
 * "İlgili departman görebilir" görünürlük seçeneği anlamlı olsun diye
 * var. İkinci bir rol/yetki sistemi DEĞİLDİR (bkz. proje kararı,
 * schema.prisma'daki Department model doc-comment'i).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = createDepartmentSchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.department.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Bu isimde bir departman zaten kayıtlı." }, { status: 409 });
    }

    const department = await prisma.department.create({ data: { name: data.name.trim(), slug } });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
