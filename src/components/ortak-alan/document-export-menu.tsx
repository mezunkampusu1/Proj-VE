"use client";

import Link from "next/link";
import { Download, Printer, FileType, FileSpreadsheet } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  documentId: string;
  /** Word dokümanları için Word/Excel özet dışa aktarımı, Excel
   * dokümanları için yalnızca gerçek tablo/formül yapısını koruyan Excel
   * dışa aktarımı sunulur (bkz. src/lib/document-format.ts,
   * document-export-xlsx-sheet.ts). */
  documentFormat: "WORD" | "EXCEL";
}

// Revizyon: "Döküman türlerinde hepsini kaldır 2 tane olsun biri word
// formatı bir tanesi excel formatı" — önceden Word/Markdown/Düz Metin/HTML
// olmak üzere 4 format vardı, kullanıcı isteğiyle yalnızca Word ve Excel
// bırakıldı (bkz. export/route.ts, document-export-xlsx.ts).
const WORD_FORMATS: { format: "docx" | "xlsx"; label: string; icon: typeof FileType }[] = [
  { format: "docx", label: "Word (.docx)", icon: FileType },
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
];
const EXCEL_FORMATS: { format: "docx" | "xlsx"; label: string; icon: typeof FileType }[] = [
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
];

/** Dışa aktarma menüsü (§ dışa aktarma + yazdırma). PDF, yazdırma görünümü üzerinden sağlanır. */
export function DocumentExportMenu({ documentId, documentFormat }: Props) {
  const FORMATS = documentFormat === "EXCEL" ? EXCEL_FORMATS : WORD_FORMATS;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Dışa aktar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-1" align="end" overlay>
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Dışa Aktar</p>
        <Link
          href={`/ortak-alan/${documentId}/print`}
          target="_blank"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <Printer className="h-4 w-4" />
          Yazdır / PDF
        </Link>
        {FORMATS.map(({ format, label, icon: Icon }) => (
          <a
            key={format}
            href={`/api/documents/${documentId}/export?format=${format}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <Icon className="h-4 w-4" />
            {label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
