import ExcelJS from "exceljs";
import type { Sheet, Cell } from "@fortune-sheet/core";

/**
 * fortune-sheet `Sheet[]` (Excel türü doküman içeriği, bkz.
 * spreadsheet-editor.tsx) → gerçek çok sayfalı .xlsx. Word türü
 * dokümanların dışa aktarma yolundan (document-export-xlsx.ts, ProseMirror
 * JSON → tek sayfalık özet tablo) TAMAMEN AYRI bir dönüştürücü: burada
 * hücre/satır/sütun yapısı ve FORMÜLLER birebir korunur (1:1 eşleme).
 */
export async function sheetsToXlsxBuffer(sheets: Sheet[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  for (const sheet of sheets.length > 0 ? sheets : [{ name: "Sayfa1" } as Sheet]) {
    let name = (sheet.name || "Sayfa").replace(/[/\\?*[\]:]/g, " ").slice(0, 31) || "Sayfa";
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${name.slice(0, 28)} ${suffix++}`;
    }
    usedNames.add(name);

    const ws = workbook.addWorksheet(name);
    const matrix = sheetToMatrix(sheet);

    matrix.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        const excelCell = ws.getCell(r + 1, c + 1);
        if (typeof cell.f === "string" && cell.f) {
          const formula = cell.f.startsWith("=") ? cell.f.slice(1) : cell.f;
          const result = typeof cell.v === "number" || typeof cell.v === "string" ? cell.v : undefined;
          excelCell.value = { formula, result } as ExcelJS.CellFormulaValue;
        } else if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
          excelCell.value = cell.v;
        }
        if (cell.bl) excelCell.font = { ...excelCell.font, bold: true };
        if (cell.it) excelCell.font = { ...excelCell.font, italic: true };
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/** Sheet.data (yoğun matris) varsa onu, yoksa Sheet.celldata (seyrek liste) üzerinden bir matris kurar. */
function sheetToMatrix(sheet: Sheet): (Cell | null)[][] {
  if (sheet.data && sheet.data.length > 0) return sheet.data;
  if (sheet.celldata && sheet.celldata.length > 0) {
    let maxR = 0;
    let maxC = 0;
    for (const entry of sheet.celldata) {
      if (entry.r > maxR) maxR = entry.r;
      if (entry.c > maxC) maxC = entry.c;
    }
    const matrix: (Cell | null)[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(null));
    for (const entry of sheet.celldata) {
      matrix[entry.r][entry.c] = entry.v;
    }
    return matrix;
  }
  return [];
}
