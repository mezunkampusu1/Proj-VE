import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createImportantDateSchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

const listInclude = {
  university: { select: { id: true, name: true, city: true } },
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get("universityId") || undefined;
    const typeId = searchParams.get("typeId") || undefined;
    const q = searchParams.get("q")?.trim();
    const entryDate = searchParams.get("entryDate") || undefined;
    const endDateStatus = searchParams.get("endDateStatus") || undefined; // "has" | "pending"
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // Bitiş tarihi (date) artık opsiyonel olduğu için "yeni nesil filtreleme"
    // çipleri bu alan üzerinden çalışır: bugün girilenler, bitiş tarihi
    // belirlenmiş/bekleyen kayıtlar, yaklaşan/süresi geçen aralıkları.
    let dateFilter: { equals?: Date; gte?: Date; lte?: Date; not?: null } | null | undefined;
    if (endDateStatus === "pending") {
      dateFilter = null;
    } else if (endDateStatus === "has" || dateFrom || dateTo) {
      dateFilter = {
        ...(endDateStatus === "has" ? { not: null } : {}),
        ...(dateFrom ? { gte: toDateOrUndefined(dateFrom) } : {}),
        ...(dateTo ? { lte: toDateOrUndefined(dateTo) } : {}),
      };
    }

    const dates = await prisma.importantDate.findMany({
      where: {
        universityId,
        typeId,
        entryDate: entryDate ? toDateOrUndefined(entryDate) : undefined,
        date: dateFilter,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: listInclude,
      // Bitiş tarihi belirlenmiş kayıtlarda en yakın deadline önce; bitiş
      // tarihi henüz belirlenmemiş kayıtlar sona düşer (en son girilen önce).
      orderBy: [{ date: { sort: "asc", nulls: "last" } }, { entryDate: "desc" }],
      take: 300,
    });

    return NextResponse.json({ dates });
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
    const data = createImportantDateSchema.parse(body);

    const date = await prisma.importantDate.create({
      data: {
        universityId: data.universityId,
        typeId: data.typeId,
        title: data.title,
        entryDate: toDateOrUndefined(data.entryDate)!,
        date: toDateOrUndefined(data.date),
        description: data.description || undefined,
        createdById: session.user.id,
      },
      include: listInclude,
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "DATE_CREATED",
      module: "DATES",
      message: `"${date.title}" tarihi eklendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ date }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
