import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachAtlasProgramMentionSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/activity";

interface Params {
  params: Promise<{ programId: string }>;
}

/**
 * POST: Bir Atlas programında kişi etiketleme — kategori etiketinden
 * (AtlasProgramTag, artık UI'da kullanılmıyor) tamamen ayrı bir ilişki.
 * Atomik `create` + P2002 yakalama (bkz. duyuru etiketleme modülündeki
 * yarış durumu düzeltmesi — çift bildirim üretmemesi için şart).
 */
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
    const { userId } = attachAtlasProgramMentionSchema.parse(body);

    await requireTeamMember(workspace.id, userId);

    let created = true;
    let mention;
    try {
      mention = await prisma.atlasProgramMention.create({ data: { atlasProgramId: programId, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        created = false;
        mention = await prisma.atlasProgramMention.findUniqueOrThrow({
          where: { atlasProgramId_userId: { atlasProgramId: programId, userId } },
        });
      } else {
        throw err;
      }
    }

    if (created && userId !== session.user.id) {
      await notifyUser({
        userId,
        type: "ATLAS_PROGRAM_MENTIONED",
        title: "Bir Atlas programında etiketlendiniz",
        message: `"${existing.name}" programında etiketlendiniz.`,
        link: `/atlas?open=${programId}`,
      });
    }

    return NextResponse.json({ mention }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
