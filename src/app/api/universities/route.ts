import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUniversitySchema } from "@/lib/validations";
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

    const universities = await prisma.university.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ universities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // Referans veri tüm modüllerde kullanıldığından oluşturma yöneticiyle sınırlı.
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = createUniversitySchema.parse(body);
    const slug = slugify(data.name);

    const existing = await prisma.university.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Bu isimde bir üniversite zaten kayıtlı." },
        { status: 409 },
      );
    }

    const university = await prisma.university.create({
      data: { name: data.name.trim(), city: data.city?.trim() || undefined, slug },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "UNIVERSITY_CREATED",
      module: "UNIVERSITIES",
      message: `"${university.name}" üniversitesi eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ university }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
