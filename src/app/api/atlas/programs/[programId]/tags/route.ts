import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachTagSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ programId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { programId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.atlasProgram.findUnique({ where: { id: programId } });
    if (!existing) throw new NotFoundError("Program bulunamadı.");

    const body = await req.json();
    const { tagId } = attachTagSchema.parse(body);

    await prisma.atlasProgramTag.upsert({
      where: { atlasProgramId_tagId: { atlasProgramId: programId, tagId } },
      create: { atlasProgramId: programId, tagId },
      update: {},
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
