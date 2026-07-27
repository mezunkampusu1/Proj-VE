import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInstituteSchema } from "@/lib/validations";
import { requireTeamAdmin, requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { slugify } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const includeInactive = searchParams.get("includeInactive") === "1";

    const institutes = await prisma.institute.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ institutes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // Enstitüler, Atlas hiyerarşisinin yapısal referans verisi olduğundan
    // üniversiteler gibi yöneticiyle sınırlı yönetilir.
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = createInstituteSchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.institute.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Bu isimde bir enstitü zaten kayıtlı." },
        { status: 409 },
      );
    }

    const institute = await prisma.institute.create({
      data: { name: data.name.trim(), slug },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "INSTITUTE_CREATED",
      module: "ATLAS",
      message: `"${institute.name}" enstitüsü eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ institute }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
