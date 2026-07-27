import ExcelJS from "exceljs";
import { toPlainText, type PMNode } from "@/lib/document-export";

/**
 * ProseMirror JSON → .xlsx (Excel). Kullanıcı isteği: "Döküman türlerinde
 * ... 2 tane olsun biri word formatı bir tanesi excel formatı" — dışa
 * aktarma menüsü artık yalnızca Word ve Excel'e indirildi (bkz.
 * document-export-menu.tsx, export/route.ts).
 *
 * Basitleştirme notu: doküman zengin metin (paragraf/başlık/liste) olduğu
 * için genel bir eşleme yapılır — her blok A sütununda bir satıra yazılır
 * (başlıklar kalın), yalnızca gerçek tablo (`table`) düğümleri satır/sütun
 * yapısını koruyarak Excel hücrelerine dağıtılır. `exceljs` projede zaten
 * kullanılıyor (bkz. institutes/universities/daily-flow içe aktarma), yeni
 * bir bağımlılık eklenmedi.
 */
export async function documentToXlsxBuffer(doc: PMNode, title: string): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  // Excel sayfa adları 31 karakteri ve "/\\?*[]" karakterlerini kabul etmez.
  const sheetName = (title || "Doküman").replace(/[/\\?*[\]:]/g, " ").slice(0, 31) || "Doküman";
  const sheet = workbook.addWorksheet(sheetName);
  sheet.getColumn(1).width = 90;
  sheet.properties.defaultRowHeight = 18;

  let rowIndex = 1;
  const titleCell = sheet.getRow(rowIndex++).getCell(1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  rowIndex++; // başlıktan sonra boş satır

  function writeTable(node: PMNode) {
    for (const row of node.content || []) {
      const cells = (row.content || []).map((cell) => toPlainText(cell).trim());
      const excelRow = sheet.getRow(rowIndex++);
      cells.forEach((text, i) => {
        const cell = excelRow.getCell(i + 1);
        cell.value = text;
        if (row === (node.content || [])[0]) cell.font = { bold: true };
        if (sheet.getColumn(i + 1).width === undefined || i > 0) {
          sheet.getColumn(i + 1).width = Math.max(sheet.getColumn(i + 1).width || 12, Math.min(text.length + 2, 60));
        }
      });
    }
    rowIndex++; // tablodan sonra boş satır
  }

  function writeBlock(node: PMNode) {
    if (node.type === "table") {
      writeTable(node);
      return;
    }
    if (node.type === "heading") {
      const cell = sheet.getRow(rowIndex++).getCell(1);
      cell.value = toPlainText(node);
      const level = Math.min(Math.max((node.attrs?.level as number) || 1, 1), 6);
      cell.font = { bold: true, size: level <= 2 ? 13 : 12 };
      return;
    }
    const text = toPlainText(node);
    if (text.trim()) {
      const lines = text.split("\n");
      for (const line of lines) {
        sheet.getRow(rowIndex++).getCell(1).value = line;
      }
    } else {
      rowIndex++; // boş blok — görsel boşluğu koru
    }
  }

  for (const block of doc.content || []) {
    writeBlock(block);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
