import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

function parseMonth(value: string | null): { start: Date; end: Date } {
  const now = new Date();
  const match = value && /^\d{4}-\d{2}$/.test(value) ? value : null;
  const year = match ? Number(match.slice(0, 4)) : now.getUTCFullYear();
  const month = match ? Number(match.slice(5, 7)) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Veri Girişi takvimi: seçilen ay için Duyuru + Tarih kayıtlarını
 * entryDate'e göre gün gün döner (bkz. kullanıcı talebi: "takvim koy,
 * hangi gün neler girildi görünsün"). Her gün için hem toplam sayı hem de
 * o günün kayıt listesi (başlık/üniversite/tür/kayıt türü) dönerek takvim
 * hücresine tıklandığında detay gösterilebilir.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const { start, end } = parseMonth(searchParams.get("month"));

    const [announcements, dates] = await Promise.all([
      prisma.announcement.findMany({
        where: { entryDate: { gte: start, lt: end } },
        select: {
          id: true,
          title: true,
          entryDate: true,
          university: { select: { name: true } },
          type: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
        },
      }),
      prisma.importantDate.findMany({
        where: { entryDate: { gte: start, lt: end } },
        select: {
          id: true,
          title: true,
          entryDate: true,
          university: { select: { name: true } },
          type: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
        },
      }),
    ]);

    interface DayItem {
      id: string;
      kind: "ANNOUNCEMENT" | "DATE";
      title: string;
      universityName: string;
      typeName: string;
      createdByName: string;
    }

    const byDay = new Map<string, DayItem[]>();

    function push(
      key: string,
      item: DayItem,
    ) {
      const list = byDay.get(key) ?? [];
      list.push(item);
      byDay.set(key, list);
    }

    for (const a of announcements) {
      push(toDateKey(a.entryDate), {
        id: a.id,
        kind: "ANNOUNCEMENT",
        title: a.title,
        universityName: a.university.name,
        typeName: a.type.name,
        createdByName: a.createdBy.name || a.createdBy.email,
      });
    }
    for (const d of dates) {
      push(toDateKey(d.entryDate), {
        id: d.id,
        kind: "DATE",
        title: d.title,
        universityName: d.university.name,
        typeName: d.type.name,
        createdByName: d.createdBy.name || d.createdBy.email,
      });
    }

    const days = Array.from(byDay.entries())
      .map(([date, items]) => ({ date, count: items.length, items }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ days, total: announcements.length + dates.length });
  } catch (error) {
    return handleApiError(error);
  }
}
