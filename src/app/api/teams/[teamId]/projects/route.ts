import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validations";
import { requireTeamMember, projectVisibilityWhere } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp, notifyUser } from "@/lib/activity";
import { createDefaultColumns } from "@/lib/tasks";

interface Params {
  params: Promise<{ teamId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;
    const membership = await requireTeamMember(teamId, session.user.id);

    const projects = await prisma.project.findMany({
      where: { teamId, ...projectVisibilityWhere(membership.role, session.user.id) },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { teamId } = await params;
    await requireTeamMember(teamId, session.user.id);

    const body = await req.json();
    const data = createProjectSchema.parse(body);
    const memberIds = Array.from(new Set(data.memberIds ?? []));

    const project = await prisma.project.create({
      data: {
        teamId,
        name: data.name,
        description: data.description ?? undefined,
        kind: data.kind ?? "DATED",
        creatorId: session.user.id,
        members: memberIds.length > 0 ? { create: memberIds.map((userId) => ({ userId })) } : undefined,
      },
    });

    // Her yeni proje, Trello tarzı düzenlenebilir varsayılan 4 sütunla açılır
    // (isimleri/sırası sonradan serbestçe değiştirilebilir).
    await createDefaultColumns(project.id);

    await logActivity({
      teamId,
      projectId: project.id,
      userId: session.user.id,
      action: "PROJECT_CREATED",
      message: `"${project.name}" projesi oluşturuldu.`,
      module: "TEAM",
      ipAddress: getClientIp(req),
    });

    // Kullanıcı talebi #6 (netleştirilmiş): projeye etiketlenen kişilere
    // bildirim gönderilir (bkz. Dosyalar/Tarihler/Atlas modüllerindeki AYNI
    // desen — FILE_MENTIONED vb.).
    await Promise.all(
      memberIds
        .filter((userId) => userId !== session.user.id)
        .map((userId) =>
          notifyUser({
            userId,
            type: "PROJECT_MENTIONED",
            title: "Bir projede etiketlendiniz",
            message: `"${project.name}" projesinde etiketlendiniz.`,
            link: `/teams/${teamId}/projects/${project.id}`,
          }),
        ),
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
