import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyUser } from "@/lib/activity";

/**
 * Farklı para birimleri ASLA doğrudan toplanmaz (bkz. proje talebi §1 —
 * "125.400 TL / 3.250 USD / 1.800 EUR / 12,5 gram altın" örneği). Tüm
 * "toplam" hesaplamaları ya `amountTry` üzerinden (TL karşılığı) ya da
 * para birimi bazında ayrı ayrı yapılır — bu dosya o iki yolu da sağlar.
 */

/** Bir para biriminin EN GÜNCEL kurunu döner (TRY için her zaman 1). */
export async function getCurrentRate(currencyId: string, isBase: boolean): Promise<number | null> {
  if (isBase) return 1;
  const latest = await prisma.financeExchangeRate.findFirst({
    where: { currencyId },
    orderBy: { createdAt: "desc" },
  });
  return latest ? Number(latest.rateToTry) : null;
}

/** amount * rateToTry — iki ondalıklı TL karşılığına yuvarlanır. */
export function computeAmountTry(amount: number, rateToTry: number): number {
  return Math.round(amount * rateToTry * 100) / 100;
}

/**
 * Sade, okunabilir tutar gösterimi — "125.400 TL", "3.250 USD",
 * "12,5 gram altın" gibi (bkz. proje talebi §1). Gram altın için birim
 * adı ayrıca yazılır, diğerlerinde para birimi kodu kullanılır.
 */
export function formatFinanceAmount(amount: number, currencyCode: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);

  if (currencyCode === "XAU_GRAM") return `${formatted} gram altın`;
  if (currencyCode === "TRY") return `${formatted} TL`;
  return `${formatted} ${currencyCode}`;
}

export function formatTry(amountTry: number): string {
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(amountTry)} TL`;
}

/**
 * Bir FinanceTransaction üzerinde değişen alanları AtlasChangeLog ile aynı
 * desende kalıcı loglar (bkz. proje talebi §10). `before`/`after` aynı
 * anahtarlara sahip düz nesnelerdir; yalnızca gerçekten değişen alanlar
 * satır olarak yazılır.
 */
export async function logFinanceChange(params: {
  transactionId: string;
  changedById: string;
  action: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DELETED" | "RESTORED";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const { transactionId, changedById, action, before, after } = params;

  if (action === "CREATED" || action === "DELETED" || action === "RESTORED" || !before || !after) {
    await prisma.financeChangeLog.create({
      data: { transactionId, changedById, action },
    });
    return;
  }

  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: Prisma.FinanceChangeLogCreateManyInput[] = [];
  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    rows.push({
      transactionId,
      changedById,
      action,
      field,
      oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
      newValue: newValue === null || newValue === undefined ? null : String(newValue),
    });
  }

  if (rows.length > 0) {
    await prisma.financeChangeLog.createMany({ data: rows });
  }
}

/** Bir kaydın "geciken" sayılıp sayılmayacağı — PENDING/PARTIALLY_PAID + tarihi geçmiş. */
export function isOverdue(status: string, transactionDate: Date, today: Date): boolean {
  if (status !== "PENDING" && status !== "PARTIALLY_PAID") return false;
  return transactionDate < today;
}

/**
 * Tekrarlama şablonu için bir sonraki oluşum tarihini hesaplar (bkz. proje
 * talebi §9 — Haftalık/Aylık/3 Aylık/6 Aylık/Yıllık/Özel periyot).
 */
export function addRecurrencePeriod(
  date: Date,
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "YEARLY" | "CUSTOM",
  customIntervalDays?: number | null,
): Date {
  const next = new Date(date);
  switch (frequency) {
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "SEMIANNUAL":
      next.setUTCMonth(next.getUTCMonth() + 6);
      break;
    case "YEARLY":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    case "CUSTOM":
      next.setUTCDate(next.getUTCDate() + Math.max(1, customIntervalDays ?? 30));
      break;
  }
  return next;
}

function todayUtcStart(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

/**
 * Aktif tekrarlayan şablonları tarar ve `nextOccurrenceDate`si bugüne
 * ulaşmış/geçmiş olanlar için yeni FinanceTransaction satırları türetir
 * (bkz. proje talebi §9 — tekrarlayan giderler otomasyonu). Cron
 * GEREKTİRMEZ; Finans sayfası her açıldığında (page.tsx) veya kayıt
 * listesi/özeti her çekildiğinde (API route'ları) çağrılır — tıpkı
 * `ensureRecurringTasksForDate` deseninde olduğu gibi. Bir şablon uzun
 * süre hiç ziyaret edilmemişse, geride kalan TÜM dönemler sırayla
 * türetilir (döngü `nextOccurrenceDate` bugünü geçene kadar sürer).
 * Yeni türeyen kayıtlar "Bekliyor" durumunda oluşturulur — kimse henüz
 * fiilen ödeme yapmamıştır, bu yalnızca ödemenin zamanı geldiğinin kaydıdır.
 */
export async function generateDueFinanceTransactions(): Promise<void> {
  const today = todayUtcStart();

  const dueTemplates = await prisma.financeRecurringTemplate.findMany({
    where: { active: true, nextOccurrenceDate: { lte: today } },
    include: { currency: true, category: { select: { name: true } } },
  });

  for (const tpl of dueTemplates) {
    let occurrence = tpl.nextOccurrenceDate;
    let generatedAny = false;
    let deactivate = false;

    while (occurrence <= today) {
      if (tpl.endDate && occurrence > tpl.endDate) {
        deactivate = true;
        break;
      }

      const rateToTry = tpl.currency.isBase ? 1 : ((await getCurrentRate(tpl.currencyId, false)) ?? 1);
      const amountTry = computeAmountTry(Number(tpl.amount), rateToTry);

      const transaction = await prisma.financeTransaction.create({
        data: {
          type: tpl.type,
          transactionDate: occurrence,
          amount: tpl.amount,
          currencyId: tpl.currencyId,
          rateToTry,
          amountTry,
          categoryId: tpl.categoryId,
          description: tpl.description ?? undefined,
          personId: tpl.personId,
          payeeName: tpl.payeeName ?? undefined,
          paymentMethod: tpl.paymentMethod ?? undefined,
          bankAccount: tpl.bankAccount ?? undefined,
          status: "PENDING",
          visibility: tpl.visibility,
          departmentId: tpl.departmentId ?? undefined,
          isRecurring: true,
          recurringTemplateId: tpl.id,
          createdById: tpl.createdById,
        },
      });

      await prisma.financeChangeLog.create({
        data: { transactionId: transaction.id, changedById: tpl.createdById, action: "CREATED" },
      });

      await notifyUser({
        userId: tpl.personId,
        type: "FINANCE_PAYMENT_DUE",
        title: tpl.type === "EXPENSE" ? "Tekrarlayan gider kaydı oluşturuldu" : "Tekrarlayan gelir kaydı oluşturuldu",
        message: `"${tpl.category.name}" için ${formatFinanceAmount(Number(tpl.amount), tpl.currency.code)} tutarında yeni bir kayıt oluşturuldu.`,
        link: `/finance/${transaction.id}`,
      });

      generatedAny = true;
      occurrence = addRecurrencePeriod(occurrence, tpl.frequency, tpl.customIntervalDays);
      if (tpl.endDate && occurrence > tpl.endDate) {
        deactivate = true;
      }
    }

    await prisma.financeRecurringTemplate.update({
      where: { id: tpl.id },
      data: {
        nextOccurrenceDate: occurrence,
        ...(generatedAny ? { lastGeneratedAt: new Date() } : {}),
        active: !deactivate,
      },
    });
  }
}

/**
 * Yaklaşan (3 gün içinde) ve geciken bekleyen ödemeler için ilgili kişiye
 * bildirim gönderir (bkz. proje talebi §9). Aynı kayıt için aynı gün
 * içinde ikinci kez bildirim GÖNDERİLMEZ — `Notification` tablosunda o
 * kayda ait bugünden bir satır olup olmadığı kontrol edilir (ayrı bir
 * "gönderildi" alanı için şema değişikliğine gerek kalmadan basit ve
 * güvenilir bir tekilleştirme).
 */
export async function notifyDuePayments(): Promise<void> {
  const today = todayUtcStart();
  const in3Days = new Date(today);
  in3Days.setUTCDate(in3Days.getUTCDate() + 3);

  const [upcoming, overdue] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
        transactionDate: { gte: today, lte: in3Days },
      },
      include: { category: { select: { name: true } }, currency: { select: { code: true } } },
    }),
    prisma.financeTransaction.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
        transactionDate: { lt: today },
      },
      include: { category: { select: { name: true } }, currency: { select: { code: true } } },
    }),
  ]);

  for (const t of upcoming) {
    await notifyOnceForTransaction({
      id: t.id,
      personId: t.personId,
      type: "FINANCE_PAYMENT_DUE",
      title: "Yaklaşan ödeme",
      // Görev #317: sunucu UTC'de çalışıyor — Türkiye saatine göre gösterim için timeZone açıkça belirtilir.
      message: `"${t.category.name}" ödemesinin tarihi ${t.transactionDate.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} — ${formatFinanceAmount(Number(t.amount), t.currency.code)}.`,
    });
  }
  for (const t of overdue) {
    await notifyOnceForTransaction({
      id: t.id,
      personId: t.personId,
      type: "FINANCE_PAYMENT_OVERDUE",
      title: "Gecikmiş ödeme",
      message: `"${t.category.name}" ödemesi ${t.transactionDate.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde gecikti — ${formatFinanceAmount(Number(t.amount), t.currency.code)}.`,
    });
  }
}

async function notifyOnceForTransaction(params: {
  id: string;
  personId: string;
  type: "FINANCE_PAYMENT_DUE" | "FINANCE_PAYMENT_OVERDUE";
  title: string;
  message: string;
}) {
  const link = `/finance/${params.id}`;
  const todayStart = todayUtcStart();
  const existing = await prisma.notification.findFirst({
    where: { userId: params.personId, type: params.type, link, createdAt: { gte: todayStart } },
    select: { id: true },
  });
  if (existing) return;
  await notifyUser({ userId: params.personId, type: params.type, title: params.title, message: params.message, link });
}
