import {
  Document as DocxDocument,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from "docx";
import type { PMNode } from "@/lib/document-export";

/**
 * ProseMirror JSON → .docx (Word). Basitleştirme notları (bkz.
 * document-export.ts'teki genel not): numaralı/madde işaretli listeler
 * gerçek Word numaralandırması yerine düz metin öneki ("•"/"1.") ile
 * temsil edilir — `docx` paketinde native numaralandırma, belge çapında
 * bir `numbering.xml` yapılandırması gerektirir ve bu kapsamda buna
 * gerek görülmedi. Bağlantılar tıklanabilir Word hiper bağlantısı olarak
 * DEĞİL, alt çizili/renkli düz metin olarak görünür. Görseller gömülmez
 * (kaynak URL'si köşeli parantez içinde metin olarak eklenir).
 */

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function runsFromInline(nodes: PMNode[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
      continue;
    }
    if (node.type === "mention") {
      runs.push(new TextRun({ text: `@${(node.attrs?.label as string) || ""}`, bold: true }));
      continue;
    }
    if (node.type === "image") {
      runs.push(new TextRun({ text: `[Görsel: ${(node.attrs?.src as string) || ""}]`, italics: true }));
      continue;
    }
    if (node.type !== "text") continue;
    const marks = node.marks || [];
    runs.push(
      new TextRun({
        text: node.text || "",
        bold: marks.some((m) => m.type === "bold"),
        italics: marks.some((m) => m.type === "italic"),
        underline: marks.some((m) => m.type === "underline" || m.type === "link") ? {} : undefined,
        strike: marks.some((m) => m.type === "strike" || m.type === "suggestionDelete"),
        color: marks.some((m) => m.type === "link")
          ? "1D4ED8"
          : marks.some((m) => m.type === "suggestionInsert")
            ? "047857"
            : marks.some((m) => m.type === "suggestionDelete")
              ? "B91C1C"
              : undefined,
        font: marks.some((m) => m.type === "code") ? "Courier New" : undefined,
      }),
    );
  }
  return runs;
}

function blockToParagraphs(node: PMNode, indentLevel = 0): (Paragraph | Table)[] {
  switch (node.type) {
    case "heading": {
      const level = Math.min(Math.max((node.attrs?.level as number) || 1, 1), 6);
      return [new Paragraph({ heading: HEADING_LEVELS[level - 1], children: runsFromInline(node.content || []) })];
    }
    case "paragraph":
      return [new Paragraph({ children: runsFromInline(node.content || []), indent: indentLevel ? { left: indentLevel * 360 } : undefined })];
    case "blockquote":
      return (node.content || []).flatMap((c) => blockToParagraphs(c, indentLevel + 1));
    case "codeBlock":
      return [
        new Paragraph({
          children: [new TextRun({ text: (node.content || []).map((c) => c.text || "").join(""), font: "Courier New" })],
          shading: { fill: "F1F5F9" },
        }),
      ];
    case "bulletList":
      return (node.content || []).flatMap((li) => [
        new Paragraph({ children: [new TextRun({ text: "• " }), ...runsFromInline(flattenInline(li))], indent: { left: 360 + indentLevel * 360 } }),
      ]);
    case "orderedList":
      return (node.content || []).flatMap((li, i) => [
        new Paragraph({ children: [new TextRun({ text: `${i + 1}. ` }), ...runsFromInline(flattenInline(li))], indent: { left: 360 + indentLevel * 360 } }),
      ]);
    case "taskList":
      return (node.content || []).flatMap((li) => [
        new Paragraph({
          children: [new TextRun({ text: li.attrs?.checked ? "☑ " : "☐ " }), ...runsFromInline(flattenInline(li))],
          indent: { left: 360 + indentLevel * 360 },
        }),
      ]);
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (node.content || []).map(
            (row) =>
              new TableRow({
                children: (row.content || []).map(
                  (cell) =>
                    new TableCell({
                      children: (cell.content || []).flatMap((c) => blockToParagraphs(c)) as Paragraph[],
                    }),
                ),
              }),
          ),
        }),
      ];
    case "horizontalRule":
      return [new Paragraph({ children: [new TextRun({ text: "─".repeat(40), color: "94A3B8" })] })];
    default:
      return (node.content || []).flatMap((c) => blockToParagraphs(c, indentLevel));
  }
}

/** listItem/taskItem içindeki paragraf düğümlerinin satır-içi içeriğini tek listeye düzleştirir. */
function flattenInline(listItem: PMNode): PMNode[] {
  const result: PMNode[] = [];
  for (const child of listItem.content || []) {
    if (child.type === "paragraph") result.push(...(child.content || []));
    else result.push(child);
  }
  return result;
}

export async function documentToDocxBuffer(doc: PMNode, title: string): Promise<Uint8Array> {
  const children = (doc.content || []).flatMap((n) => blockToParagraphs(n));
  const docxFile = new DocxDocument({
    title,
    sections: [{ children: children.length ? children : [new Paragraph({ children: [new TextRun({ text: "" })] })] }],
  });
  return Packer.toBuffer(docxFile);
}
