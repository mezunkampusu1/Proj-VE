import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachAnnouncementMentionSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyUser } from "@/lib/activity";

interface Params {
  params: Promise<{ announcementId: string }>;
}

/**
 * POST: Bir duyuruda kişi etiketleme — kategori etiketinden (AnnouncementTag)
 * tamamen ayrı bir ilişki. Etiketlenen kişiye ANNOUNCEMENT_MENTIONED
 * bildirimi gönderilir (bkz. proje talebi: "Yeni etiket kısmında üyeler
 * gelebilmeli... etiketlendiğinde bildirim düşmeli", görev #172).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { announcementId } = await params;
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!existing) throw new NotFoundError("Duyuru bulunamadı.");

    const body = await req.json();
    const { userId } = attachAnnouncementMentionSchema.parse(body);

    // Etiketlenecek kişinin de aynı takımda olduğunu doğrula.
    await requireTeamMember(workspace.id, userId);

    // Bildirim yalnızca etiket GERÇEKTEN YENİ oluşturulduysa gönderilir.
    // Önceki sürüm önce `findUnique` ile var olup olmadığını kontrol edip
    // sonra `upsert` yapıyordu — bu iki adım arasında yarış durumu (race
    // condition) vardı: kullanıcı butona çift tıklarsa veya tarayıcı isteği
    // iki kez gönderirse, her iki istek de "henüz yok" görüp ikisi de
    // bildirim gönderebiliyordu (bkz. kullanıcı raporu: "kişi etiket atınca
    // 2 tane bildirim geldi" — sorun ısrar etti çünkü asıl neden bu yarış
    // durumuydu, tekil `upsert` çağrısı değil). Artık doğrudan `create`
    // deneniyor; satır zaten varsa veritabanı @@id kısıtı P2002 hatası
    // fırlatır ve bu durumda bildirim gönderilmez — atomik, yarış durumuna
    // kapalı bir garanti.
    let created = true;
    let mention;
    try {
      mention = await prisma.announcementMention.create({ data: { announcementId, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        created = false;
        mention = await prisma.announcementMention.findUniqueOrThrow({
          where: { announcementId_userId: { announcementId, userId } },
        });
      } else {
        throw err;
      }
    }

    // Kendini etiketlemek anlamsız — kendine bildirim gönderilmez (bkz.
    // dosya kişi etiketleme akışındaki aynı desen).
    if (created && userId !== session.user.id) {
      await notifyUser({
        userId,
        type: "ANNOUNCEMENT_MENTIONED",
        title: "Bir duyuruda etiketlendiniz",
        message: `"${existing.title}" duyurusunda etiketlendiniz.`,
        link: `/announcements?open=${announcementId}`,
      });
    }

    return NextResponse.json({ mention }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
