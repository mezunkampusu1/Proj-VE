import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAtlasProgramSchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { createAtlasProgramWithLog, atlasProgramDetailInclude } from "@/lib/atlas";
import { toDateOrUndefined } from "@/lib/dates";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get("instituteId") || undefined;
    const degreeLevel = searchParams.get("degreeLevel") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "1";
    const q = searchParams.get("q")?.trim();
    const entryDate = searchParams.get("entryDate") || undefined;
    const updatedToday = searchParams.get("updatedToday") === "1";

    let updatedAtFilter: { gte: Date } | undefined;
    if (updatedToday) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      updatedAtFilter = { gte: start };
    }

    const programs = await prisma.atlasProgram.findMany({
      where: {
        instituteId,
        degreeLevel: degreeLevel as "YUKSEK_LISANS" | "DOKTORA" | undefined,
        ...(includeInactive ? {} : { isActive: true }),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        entryDate: entryDate ? toDateOrUndefined(entryDate) : undefined,
        updatedAt: updatedAtFilter,
      },
      include: atlasProgramDetailInclude,
      // "Sürekli güncellenenler" görünürlüğü için en son değişen program
      // listenin başında — Duyurular/Tarihler'in aksine burada asıl önemli
      // olan "en son ne değişti" sorusu (bkz. kullanıcı geri bildirimi).
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ programs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const body = await req.json();
    const data = createAtlasProgramSchema.parse(body);

    const program = await createAtlasProgramWithLog({
      instituteId: data.instituteId,
      name: data.name,
      degreeLevel: data.degreeLevel,
      isActive: true,
      entryDate: toDateOrUndefined(data.entryDate)!,
      createdById: session.user.id,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "ATLAS_PROGRAM_CREATED",
      module: "ATLAS",
      message: `"${program.name}" programı eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
