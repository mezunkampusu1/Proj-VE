import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ tagId: string }>;
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { tagId } = await params;

    // Etiketler çalışma alanı genelinde ortak olduğundan silme işlemi
    // yöneticiyle sınırlıdır.
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    await prisma.tag.delete({ where: { id: tagId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
