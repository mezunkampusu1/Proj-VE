import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateInstituteSchema } from "@/lib/validations";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { slugify } from "@/lib/utils";

interface Params {
  params: Promise<{ instituteId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { instituteId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const body = await req.json();
    const data = updateInstituteSchema.parse(body);

    const institute = await prisma.institute.update({
      where: { id: instituteId },
      data: {
        name: data.name?.trim(),
        slug: data.name ? slugify(data.name) : undefined,
        isActive: data.isActive,
      },
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "INSTITUTE_UPDATED",
      module: "ATLAS",
      message: `"${institute.name}" enstitüsü güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ institute });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { instituteId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      include: { _count: { select: { programs: true } } },
    });
    if (!institute) {
      return NextResponse.json({ error: "Enstitü bulunamadı." }, { status: 404 });
    }
    if (institute._count.programs > 0) {
      // Institute -> AtlasProgram ilişkisi onDelete: Cascade olduğundan,
      // korumasız bir silme altındaki tüm programları sessizce yok eder.
      // Veri kaybını önlemek için önce programların taşınmasını/
      // silinmesini isteriz.
      return NextResponse.json(
        { error: "Bu enstitüye bağlı programlar var, önce onları silin veya taşıyın." },
        { status: 409 },
      );
    }

    await prisma.institute.delete({ where: { id: instituteId } });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "INSTITUTE_DELETED",
      module: "ATLAS",
      message: `"${institute.name}" enstitüsü silindi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // instituteId FK'sı Atlas programlarında onDelete: Cascade olduğundan
    // burada bir kısıt hatası beklenmez, ama savunmacı olmak için yine de
    // handleApiError'a devredilir.
    return handleApiError(error);
  }
}
