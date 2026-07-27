import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUniversitySchema } from "@/lib/validations";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { slugify } from "@/lib/utils";

interface Params {
  params: Promise<{ universityId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { universityId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = updateUniversitySchema.parse(body);

    const university = await prisma.university.update({
      where: { id: universityId },
      data: {
        name: data.name?.trim(),
        slug: data.name ? slugify(data.name) : undefined,
        city: data.city === undefined ? undefined : data.city?.trim() || null,
        isActive: data.isActive,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "UNIVERSITY_UPDATED",
      module: "UNIVERSITIES",
      message: `"${university.name}" üniversitesi güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ university });
  } catch (error) {
    return handleApiError(error);
  }
}
