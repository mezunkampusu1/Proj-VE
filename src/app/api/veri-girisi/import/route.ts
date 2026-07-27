import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnouncementSchema, createImportantDateSchema } from "@/lib/validations";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import { toDateOrUndefined } from "@/lib/dates";

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const KIND_HEADERS = ["kayıt türü", "kayit turu", "kayittürü", "kayitturu", "kayıt tur"];
const TITLE_HEADERS = ["başlık", "baslik", "title"];
const UNIVERSITY_HEADERS = ["üniversite", "universite", "university"];
const TYPE_HEADERS = ["tür", "tur", "type"];
const DATE_HEADERS = ["giriş tarihi", "giris tarihi", "tarih", "date"];

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

/**
 * Duyurular/Tarihler içe aktarma deseniyle (institutes/import) birebir
 * aynı: başlık satırı bilinen sinonimlerle taranır, eşleşmezse sabit
 * pozisyona (A-E) düşer — "Kayıt Türü, Başlık, Üniversite, Tür, Giriş
 * Tarihi" sırası, kişinin kolay doldurabilmesi için.
 */
function resolveColumns(headerRow: ExcelJS.Row) {
  let kindCol: number | null = null;
  let titleCol: number | null = null;
  let universityCol: number | null = null;
  let typeCol: number | null = null;
  let dateCol: number | null = null;

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalize(cell.value);
    if (kindCol === null && KIND_HEADERS.includes(header)) kindCol = colNumber;
    else if (titleCol === null && TITLE_HEADERS.includes(header)) titleCol = colNumber;
    else if (universityCol === null && UNIVERSITY_HEADERS.includes(header)) universityCol = colNumber;
    else if (typeCol === null && TYPE_HEADERS.includes(header)) typeCol = colNumber;
    else if (dateCol === null && DATE_HEADERS.includes(header)) dateCol = colNumber;
  });

  return {
    kindCol: kindCol ?? 1,
    titleCol: titleCol ?? 2,
    universityCol: universityCol ?? 3,
    typeCol: typeCol ?? 4,
    dateCol: dateCol ?? 5,
  };
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (typeof v === "object" && v instanceof Date) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v.richText as { text: string }[]).map((t) => t.text).join("").trim();
  }
  if (typeof v === "object" && "text" in v) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  return String(v).trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Excel tarih hücresini (gerçek Date hücresi veya "GG.AA.YYYY"/"YYYY-AA-GG" metni) ISO'ya çevirir. */
function cellToIsoDate(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell || cell.value == null) return null;
  const v = cell.value;
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  }
  const text = cellText(cell);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${pad2(Number(mm))}-${pad2(Number(dd))}`;
  }
  return null;
}

function resolveKind(text: string): "ANNOUNCEMENT" | "DATE" | null {
  const t = normalize(text);
  if (!t) return null;
  if (t.startsWith("duyuru")) return "ANNOUNCEMENT";
  if (t.startsWith("tarih") || t.includes("önemli")) return "DATE";
  return null;
}

/**
 * Veri Girişi toplu Excel içe aktarma. Duyurular/Tarihler modüllerinin
 * kendi API'lerini (POST /api/announcements, /api/dates) DEĞİŞTİRMEZ —
 * bu uç, ekip üyesinin bir Excel dosyasından her satırı okuyup aynı
 * doğrulama kurallarıyla ilgili tabloya (Announcement/ImportantDate)
 * kayıt açar. Kolon sırası: Kayıt Türü, Başlık, Üniversite, Tür, Giriş
 * Tarihi (bkz. kullanıcı talebi — çalışanların yorulmadan toplu girebilmesi).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    // Tekli giriş formunda olduğu gibi (POST /api/announcements, /api/dates)
    // yönetici şartı yok — asıl amaç bu verileri giren çalışanların işini
    // kolaylaştırmak, bu yüzden içe aktarma da tüm ekip üyelerine açık.
    await requireTeamMember(workspace.id, session.user.id);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ error: "Yalnızca .xlsx dosyaları desteklenir." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_SIZE_BYTES) {
      return NextResponse.json({ error: "Dosya boyutu 10 MB'ı aşamaz." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "Dosyada okunabilir bir sayfa bulunamadı." }, { status: 400 });
    }

    const headerRow = sheet.getRow(1);
    const { kindCol, titleCol, universityCol, typeCol, dateCol } = resolveColumns(headerRow);

    const [universities, announcementTypes, dateTypes] = await Promise.all([
      prisma.university.findMany({ select: { id: true, name: true } }),
      prisma.announcementType.findMany({ select: { id: true, name: true } }),
      prisma.importantDateType.findMany({ select: { id: true, name: true } }),
    ]);
    const universityMap = new Map(universities.map((u: { id: string; name: string }) => [normalize(u.name), u.id]));
    const announcementTypeMap = new Map(
      announcementTypes.map((t: { id: string; name: string }) => [normalize(t.name), t.id]),
    );
    const dateTypeMap = new Map(dateTypes.map((t: { id: string; name: string }) => [normalize(t.name), t.id]));

    let createdAnnouncements = 0;
    let createdDates = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const kindRaw = cellText(row.getCell(kindCol));
      const title = cellText(row.getCell(titleCol));
      const universityName = cellText(row.getCell(universityCol));
      const typeName = cellText(row.getCell(typeCol));
      const entryDate = cellToIsoDate(row.getCell(dateCol));

      // Tamamen boş satırları sessizce atla.
      if (!kindRaw && !title && !universityName && !typeName && !entryDate) continue;

      const kind = resolveKind(kindRaw);
      if (!kind) {
        skipped++;
        errors.push(`Satır ${rowNumber}: Kayıt Türü "Duyuru" veya "Tarih" olmalı.`);
        continue;
      }
      if (!title) {
        skipped++;
        errors.push(`Satır ${rowNumber}: başlık boş.`);
        continue;
      }
      const universityId = universityMap.get(normalize(universityName));
      if (!universityId) {
        skipped++;
        errors.push(`Satır ${rowNumber}: "${universityName || "(boş)"}" adında üniversite bulunamadı.`);
        continue;
      }
      const typeMap = kind === "ANNOUNCEMENT" ? announcementTypeMap : dateTypeMap;
      const typeId = typeMap.get(normalize(typeName));
      if (!typeId) {
        skipped++;
        errors.push(`Satır ${rowNumber}: "${typeName || "(boş)"}" adında tür bulunamadı.`);
        continue;
      }
      if (!entryDate) {
        skipped++;
        errors.push(`Satır ${rowNumber}: geçerli bir Giriş Tarihi girin (GG.AA.YYYY).`);
        continue;
      }

      if (kind === "ANNOUNCEMENT") {
        const parsed = createAnnouncementSchema.safeParse({ universityId, typeId, title, entryDate });
        if (!parsed.success) {
          skipped++;
          errors.push(`Satır ${rowNumber}: ${parsed.error.issues[0]?.message ?? "geçersiz kayıt."}`);
          continue;
        }
        await prisma.announcement.create({
          data: {
            universityId,
            typeId,
            title,
            entryDate: toDateOrUndefined(entryDate)!,
            createdById: session.user.id,
          },
        });
        createdAnnouncements++;
      } else {
        const parsed = createImportantDateSchema.safeParse({ universityId, typeId, title, entryDate });
        if (!parsed.success) {
          skipped++;
          errors.push(`Satır ${rowNumber}: ${parsed.error.issues[0]?.message ?? "geçersiz kayıt."}`);
          continue;
        }
        await prisma.importantDate.create({
          data: {
            universityId,
            typeId,
            title,
            entryDate: toDateOrUndefined(entryDate)!,
            createdById: session.user.id,
          },
        });
        createdDates++;
      }
    }

    const ip = getClientIp(req);
    if (createdAnnouncements > 0) {
      await logActivity({
        teamId: workspace.id,
        userId: session.user.id,
        action: "ANNOUNCEMENT_IMPORTED",
        module: "ANNOUNCEMENTS",
        message: `Veri Girişi Excel içe aktarma: ${createdAnnouncements} duyuru eklendi.`,
        ipAddress: ip,
      });
    }
    if (createdDates > 0) {
      await logActivity({
        teamId: workspace.id,
        userId: session.user.id,
        action: "DATE_IMPORTED",
        module: "DATES",
        message: `Veri Girişi Excel içe aktarma: ${createdDates} tarih eklendi.`,
        ipAddress: ip,
      });
    }

    return NextResponse.json({
      createdAnnouncements,
      createdDates,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
