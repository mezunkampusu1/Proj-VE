import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { pushSpreadsheetOpsSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ documentId: string }>;
}

/**
 * Kullanıcı talebi #16: "Ortak alanda Excel formatında ortak çalışılmıyor —
 * word formatta ... hızlı ... excel formatta bu olmuyor". Word Yjs/Hocuspocus
 * (bkz. collab-server/) ile CRDT tabanlı gerçek zamanlı senkronizasyon
 * kullanır; fortune-sheet (Excel editörü) bu altyapıya sahip değil, kendi
 * onOp/applyOp çiftini sağlıyor (bkz. src/components/ortak-alan/
 * spreadsheet-editor.tsx). Bu uç nokta o çiftin YAYIN (broadcast) rölesidir:
 * bir kullanıcının ürettiği atomik işlemler burada kısa süreliğine saklanır,
 * diğer açık sekmeler GET ile bunları çekip kendi tablolarına uygular.
 *
 * Kalıcı içerik hâlâ documents.content'te tutulur (spreadsheet-editor.tsx'te
 * değişmeyen debounce'lu PATCH akışı) — bu tablo yalnızca canlı yayın için,
 * bu yüzden her POST'ta birkaç dakikadan eski satırlar temizlenir.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "EDITOR");

    const body = await req.json();
    const data = pushSpreadsheetOpsSchema.parse(body);

    const created = await prisma.spreadsheetOp.create({
      data: {
        documentId,
        userId: session.user.id,
        ops: data.ops as object,
      },
      select: { id: true, createdAt: true },
    });

    // Best-effort temizlik: bu tablo kalıcı geçmiş değil, yalnızca canlı
    // röle — 5 dakikadan eski satırların birikmesine gerek yok.
    await prisma.spreadsheetOp
      .deleteMany({
        where: { documentId, createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
      })
      .catch(() => {});

    return NextResponse.json({ id: created.id, createdAt: created.createdAt });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET ?since=<ISO> — `since`'ten sonra, İSTEĞİ YAPAN KULLANICI DIŞINDAKİ
 * herkesin yayınladığı işlemleri döner (kendi işlemlerimiz zaten yerel
 * olarak anında uygulanmış durumda — fortune-sheet onOp'u yerel değişiklik
 * ANINDA, sunucu round-trip'i beklemeden tetikler). `serverTime` istemcinin
 * bir sonraki `since` değeri olarak kullanılması İÇİN döner — istemci saati
 * yerine sunucu saatine güvenmek saat kayması hatalarını önler.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : new Date(0);

    const rows = await prisma.spreadsheetOp.findMany({
      where: {
        documentId,
        createdAt: { gt: since },
        userId: { not: session.user.id },
      },
      orderBy: { id: "asc" },
      select: { id: true, userId: true, ops: true, createdAt: true },
    });

    return NextResponse.json({
      ops: rows.map((r) => ({ id: r.id, userId: r.userId, ops: r.ops })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
