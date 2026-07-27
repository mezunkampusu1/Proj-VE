import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logDocumentAudit } from "@/lib/document-audit";
import { getClientIp } from "@/lib/activity";
import type { PMNode } from "@/lib/document-export";
import { documentToDocxBuffer } from "@/lib/document-export-docx";
import { documentToXlsxBuffer } from "@/lib/document-export-xlsx";
import { sheetsToXlsxBuffer } from "@/lib/document-export-xlsx-sheet";
import { getDocumentFormat } from "@/lib/document-format";
import { slugify } from "@/lib/utils";
import type { Sheet } from "@fortune-sheet/core";

interface Params {
  params: Promise<{ documentId: string }>;
}

// Revizyon: "Döküman türlerinde ... 2 tane olsun biri word formatı bir
// tanesi excel formatı" — dışa aktarma artık yalnızca Word ve Excel'e
// indirildi (Markdown/Düz Metin/HTML kaldırıldı).
const FORMATS = ["docx", "xlsx"] as const;
type Format = (typeof FORMATS)[number];

const CONTENT_TYPES: Record<Format, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * GET: Dokümanı istenen formatta dışa aktarır (§ dışa aktarma). İndirme
 * her erişim düzeyinde serbesttir (bkz. paylaşım API'sindeki karar notu),
 * bu yüzden yalnızca VIEWER erişimi yeterlidir. PDF için ayrı bir uç YOK
 * — /ortak-alan/[documentId]/print sayfası, tarayıcının "Yazdır → PDF
 * olarak kaydet" özelliğini kullanır (bkz. o sayfadaki not).
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new NotFoundError("Doküman bulunamadı.");

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") as Format | null;
    if (!format || !FORMATS.includes(format)) {
      return NextResponse.json({ error: "Geçersiz format. Desteklenenler: docx, xlsx." }, { status: 400 });
    }

    const documentFormat = getDocumentFormat(document.typeId);
    if (documentFormat === "EXCEL" && format === "docx") {
      return NextResponse.json({ error: "Excel türü dokümanlar Word formatında dışa aktarılamaz." }, { status: 400 });
    }

    const filename = `${slugify(document.title) || "dokuman"}.${format}`;

    let body: Uint8Array;
    if (documentFormat === "EXCEL") {
      const sheets = (document.content as Sheet[] | null) || [];
      body = await sheetsToXlsxBuffer(sheets);
    } else {
      const pmDoc = (document.content as PMNode | null) || { type: "doc", content: [] };
      body = format === "xlsx" ? await documentToXlsxBuffer(pmDoc, document.title) : await documentToDocxBuffer(pmDoc, document.title);
    }

    await logDocumentAudit({
      documentId,
      documentTitleSnapshot: document.title,
      actorId: session.user.id,
      action: "EXPORTED",
      description: `Doküman ${format.toUpperCase()} olarak dışa aktarıldı.`,
      ipAddress: getClientIp(req),
    });

    return new NextResponse(body as BodyInit, {
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
