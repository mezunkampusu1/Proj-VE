import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProjectSchema } from "@/lib/validations";
import { requireProjectAccess, PermissionError } from "@/lib/permissions";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/activity";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    await requireProjectAccess(projectId, session.user.id);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: { user: { select: { id: true, name: true, email: true, image: true } } },
            },
          },
        },
        tasks: {
          include: {
            assignees: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            subtasks: true,
            _count: { select: { comments: true } },
          },
          orderBy: [{ columnId: "asc" }, { position: "asc" }],
        },
      },
    });

    return NextResponse.json({
      project: {
        ...project,
        tasks: project.tasks.map((t) => ({ ...t, assignees: t.assignees.map((a) => a.user) })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    const { project: existing, membership } = await requireProjectAccess(projectId, session.user.id);

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    // Kullanıcı talebi: "kişiyi en baştan etiketlemedim ya da gruba
    // sonradan dahil oldu, sonradan etiketleyebileyim" — proje oluşturma
    // dışında, oluşturulmuş bir projenin etiketli kişi listesi de artık
    // sonradan değiştirilebiliyor (bkz. create-project-form.tsx'teki AYNI
    // Kişi Etiketle deseni, burada edit-project-members-dialog.tsx). Bu
    // görünürlüğü belirleyen hassas bir alan olduğu için yalnızca oluşturan
    // veya admin değiştirebilir (görev silme yetkisindeki AYNI kısıtlama).
    let newlyAddedMemberIds: string[] = [];
    if (data.memberIds !== undefined) {
      const isCreator = existing.creatorId === session.user.id;
      if (!isCreator && membership.role !== "ADMIN") {
        throw new PermissionError("Kişi etiketlerini yalnızca oluşturan veya yönetici değiştirebilir.");
      }
      const previousMemberIds = existing.members.map((m: { userId: string }) => m.userId);
      const nextMemberIds = Array.from(new Set(data.memberIds));
      newlyAddedMemberIds = nextMemberIds.filter(
        (id) => !previousMemberIds.includes(id) && id !== session.user.id,
      );
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        description: data.description ?? undefined,
        status: data.status,
        ...(data.memberIds !== undefined
          ? {
              members: {
                deleteMany: {},
                create: Array.from(new Set(data.memberIds)).map((userId) => ({ userId })),
              },
            }
          : {}),
      },
    });

    if (newlyAddedMemberIds.length > 0) {
      await Promise.all(
        newlyAddedMemberIds.map((userId) =>
          notifyUser({
            userId,
            type: "PROJECT_MENTIONED",
            title: "Bir projede etiketlendiniz",
            message: `"${project.name}" projesinde etiketlendiniz.`,
            link: `/teams/${existing.teamId}/projects/${project.id}`,
          }),
        ),
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { projectId } = await params;
    const { project: existing, membership } = await requireProjectAccess(projectId, session.user.id);

    // Kullanıcı talebi: "kişi sadece göreve etiketliyse projeyi silemesin,
    // sadece proje sahibi + admin silebilsin" — PATCH'teki üye listesi
    // değiştirme kısıtlamasıyla (yukarıda) AYNI kural, silme için de geçerli.
    const isCreator = existing.creatorId === session.user.id;
    if (!isCreator && membership.role !== "ADMIN") {
      throw new PermissionError("Bu projeyi yalnızca oluşturan veya yönetici silebilir.");
    }

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
