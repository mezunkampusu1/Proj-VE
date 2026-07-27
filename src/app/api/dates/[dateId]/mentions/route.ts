import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachImportantDateMentionSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/activity";

interface Params {
  params: Promise<{ dateId: string }>;
}

/**
 * POST: Bir tarih kaydında kişi etiketleme — kategori etiketinden
 * (ImportantDateTag, artık UI'da kullanılmıyor) tamamen ayrı bir ilişki.
 * AnnouncementMention ile birebir aynı desen (bkz. kullanıcı talebi:
 * "Tarihler kısmında kişi etiketle yok onu ekle"). Atomik `create` + P2002
 * yakalama kullanılır ki çift tıklama/ağ yeniden denemesi çift bildirim
 * üretmesin (bkz. duyuru etiketleme modülündeki aynı yarış durumu düzeltmesi).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { dateId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.importantDate.findUnique({ where: { id: dateId } });
    if (!existing) throw new NotFoundError("Tarih bulunamadı.");

    const body = await req.json();
    const { userId } = attachImportantDateMentionSchema.parse(body);

    await requireTeamMember(workspace.id, userId);

    let created = true;
    let mention;
    try {
      mention = await prisma.importantDateMention.create({ data: { importantDateId: dateId, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        created = false;
        mention = await prisma.importantDateMention.findUniqueOrThrow({
          where: { importantDateId_userId: { importantDateId: dateId, userId } },
        });
      } else {
        throw err;
      }
    }

    if (created && userId !== session.user.id) {
      await notifyUser({
        userId,
        type: "IMPORTANT_DATE_MENTIONED",
        title: "Bir tarih kaydında etiketlendiniz",
        message: `"${existing.title}" kaydında etiketlendiniz.`,
        link: `/dates?open=${dateId}`,
      });
    }

    return NextResponse.json({ mention }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
