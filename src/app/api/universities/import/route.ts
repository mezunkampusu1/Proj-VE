import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { slugify } from "@/lib/utils";

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const NAME_HEADERS = ["ad", "isim", "üniversite", "universite", "name", "üniversite adı", "universite adi"];
const CITY_HEADERS = ["şehir", "sehir", "city", "il"];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

/**
 * Bir satırdaki hücreleri, başlık satırına göre bulunan isim/şehir sütun
 * indekslerinden okur. Başlık eşleşmezse ilk iki sütunu (A, B) kullanır.
 */
function resolveColumns(headerRow: ExcelJS.Row): { nameCol: number; cityCol: number | null } {
  let nameCol: number | null = null;
  let cityCol: number | null = null;

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cell.value);
    if (nameCol === null && NAME_HEADERS.includes(header)) nameCol = colNumber;
    if (cityCol === null && CITY_HEADERS.includes(header)) cityCol = colNumber;
  });

  return { nameCol: nameCol ?? 1, cityCol: cityCol };
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (typeof v === "object" && "richText" in v) {
    return (v.richText as { text: string }[]).map((t) => t.text).join("");
  }
  if (typeof v === "object" && "text" in v) {
    return String((v as { text: unknown }).text ?? "");
  }
  return String(v).trim();
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // İçe aktarma toplu veri değişikliği yaptığından yöneticiyle sınırlıdır.
    await requireTeamAdmin(workspace.id, session.user.id);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Yalnızca .xlsx dosyaları desteklenir." },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMPORT_SIZE_BYTES) {
      return NextResponse.json({ error: "Dosya boyutu 10 MB'ı aşamaz." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs'in gömülü tip tanımları, projenin @types/node sürümündeki
    // genişletilmiş (resizable) Buffer tipiyle yapısal olarak uyuşmuyor —
    // çalışma zamanında etkisi yok, yalnızca derleme zamanı uyumluluğu için.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Dosyada okunabilir bir sayfa bulunamadı." }, { status: 400 });
    }

    const headerRow = sheet.getRow(1);
    const { nameCol, cityCol } = resolveColumns(headerRow);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const seenSlugs = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const name = cellText(row.getCell(nameCol));
      if (!name) {
        continue;
      }
      const city = cityCol ? cellText(row.getCell(cityCol)) : "";
      const slug = slugify(name);

      if (!slug) {
        skipped++;
        errors.push(`Satır ${rowNumber}: geçersiz üniversite adı.`);
        continue;
      }
      if (seenSlugs.has(slug)) {
        skipped++;
        errors.push(`Satır ${rowNumber}: "${name}" dosya içinde tekrar ediyor, atlandı.`);
        continue;
      }
      seenSlugs.add(slug);

      const existing = await prisma.university.findUnique({ where: { slug } });
      if (existing) {
        await prisma.university.update({
          where: { id: existing.id },
          data: { city: city || existing.city, isActive: true },
        });
        updated++;
      } else {
        await prisma.university.create({
          data: { name, city: city || undefined, slug },
        });
        created++;
      }
    }

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "UNIVERSITY_IMPORTED",
      module: "UNIVERSITIES",
      message: `Excel içe aktarma: ${created} eklendi, ${updated} güncellendi, ${skipped} atlandı.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 20) });
  } catch (error) {
    return handleApiError(error);
  }
}
