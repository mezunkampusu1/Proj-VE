import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { toDateOrUndefined } from "@/lib/dates";
import { computeDurations } from "@/lib/daily-flow";
import { dailyFlowStatusLabel } from "@/lib/utils";

/** GET: Filtrelenmiş Günlük Akış kayıtlarını .xlsx olarak dışa aktarır. */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const teamUserIds = (
      await prisma.teamMember.findMany({ where: { teamId: workspace.id }, select: { userId: true } })
    ).map((m) => m.userId);

    const entries = await prisma.dailyFlowEntry.findMany({
      where: {
        userId: userId ? userId : { in: teamUserIds },
        date: {
          gte: from ? toDateOrUndefined(from) : undefined,
          lte: to ? toDateOrUndefined(to) : undefined,
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        breaks: true,
      },
      orderBy: [{ date: "desc" }, { user: { name: "asc" } }],
      take: 5000,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Günlük Akış");
    sheet.columns = [
      { header: "Kullanıcı", key: "user", width: 26 },
      { header: "Tarih", key: "date", width: 14 },
      { header: "Durum", key: "status", width: 16 },
      { header: "Başlangıç", key: "start", width: 12 },
      { header: "Bitiş", key: "end", width: 12 },
      { header: "Aktif Süre (dk)", key: "active", width: 16 },
      { header: "Ara Süresi (dk)", key: "breakMin", width: 16 },
      { header: "Ara Sayısı", key: "breakCount", width: 12 },
      { header: "Not", key: "note", width: 30 },
    ];

    for (const entry of entries) {
      const durations = computeDurations(entry);
      sheet.addRow({
        user: entry.user.name || entry.user.email,
        date: entry.date.toISOString().slice(0, 10),
        status: dailyFlowStatusLabel(entry.status),
        start: entry.startedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }),
        end: entry.completedAt
          ? entry.completedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })
          : "",
        active: Math.round(durations.activeSeconds / 60),
        breakMin: Math.round(durations.breakSeconds / 60),
        breakCount: durations.closedBreakCount,
        note: entry.note ?? "",
      });
    }
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="gunluk-akis-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
