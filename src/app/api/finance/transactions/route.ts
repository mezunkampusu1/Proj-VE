import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFinanceTransactionSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import {
  resolveFinancePermissions,
  assertPermission,
  financeVisibilityWhere,
} from "@/lib/finance-permissions";
import { getCurrentRate, computeAmountTry, addRecurrencePeriod, generateDueFinanceTransactions, notifyDuePayments } from "@/lib/finance";
import type { Prisma } from "@prisma/client";

const transactionInclude = {
  currency: { select: { id: true, code: true, name: true, symbol: true, decimalPlaces: true } },
  category: { select: { id: true, name: true, type: true, parentCategoryId: true } },
  person: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  lastEditedBy: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  visibleUsers: { select: { userId: true } },
  attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.FinanceTransactionInclude;

const PAGE_SIZE = 50;

/**
 * Finans kayıt listesi — tüm filtreler sunucu tarafında uygulanır (bkz.
 * proje talebi §6/§12). Görünürlük her zaman `financeVisibilityWhere` ile
 * DB seviyesinde zorlanır; hiçbir kayıt client'a "gizlice" sızmaz.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canViewFinance, "Finans sayfasını görüntüleme yetkiniz yok.");

    await generateDueFinanceTransactions();
    await notifyDuePayments();

    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { departmentId: true } });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const type = searchParams.get("type");
    const personId = searchParams.get("personId");
    const categoryId = searchParams.get("categoryId");
    const currencyId = searchParams.get("currencyId");
    const paymentMethod = searchParams.get("paymentMethod");
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");
    const payee = searchParams.get("payee")?.trim();
    const hasDocument = searchParams.get("hasDocument"); // "1" | "0"
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim();
    const noLimit = searchParams.get("noLimit") === "1"; // dışa aktarma için

    const where: Prisma.FinanceTransactionWhereInput = {
      deletedAt: null,
      ...(type === "INCOME" || type === "EXPENSE" ? { type } : {}),
      ...(personId ? { personId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(currencyId ? { currencyId } : {}),
      ...(paymentMethod ? { paymentMethod: paymentMethod as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(visibility ? { visibility: visibility as never } : {}),
      ...(payee ? { payeeName: { contains: payee, mode: "insensitive" } } : {}),
      ...(hasDocument === "1" ? { attachments: { some: {} } } : {}),
      ...(hasDocument === "0" ? { attachments: { none: {} } } : {}),
      ...(from || to
        ? {
            transactionDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { payeeName: { contains: q, mode: "insensitive" } },
              { receiptNumber: { contains: q, mode: "insensitive" } },
              { person: { name: { contains: q, mode: "insensitive" } } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      AND: [financeVisibilityWhere(session.user.id, membership.role, permissions, me?.departmentId ?? null)],
    };

    const [transactions, total] = await Promise.all([
      prisma.financeTransaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        ...(noLimit ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      }),
      prisma.financeTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: !noLimit && page * PAGE_SIZE < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    const membership = await requireTeamMember(workspace.id, session.user.id);
    const permissions = await resolveFinancePermissions(session.user.id, membership.role);
    assertPermission(permissions.canCreateRecords, "Finans kaydı ekleme yetkiniz yok.");

    const body = await req.json();
    const data = createFinanceTransactionSchema.parse(body);

    // Para birimi doğrulaması
    const currency = await prisma.financeCurrency.findUnique({ where: { id: data.currencyId } });
    if (!currency || !currency.isActive) throw new NotFoundError("Para birimi bulunamadı.");

    // Kategori doğrulaması — tür kategoriyle uyuşmalı
    const category = await prisma.financeCategory.findUnique({ where: { id: data.categoryId } });
    if (!category || !category.isActive) throw new NotFoundError("Kategori bulunamadı.");
    if (category.type !== data.type) {
      return NextResponse.json({ error: "Kategori türü, kayıt türüyle uyuşmuyor." }, { status: 400 });
    }

    // Kayıt sahipliği kontrolü: personId gerçek bir takım üyesi olmalı
    await requireTeamMember(workspace.id, data.personId).catch(() => {
      throw new PermissionError("Seçilen kişi bu ekibin üyesi değil.");
    });

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept) throw new NotFoundError("Departman bulunamadı.");
    }

    if (data.visibility === "SPECIFIC_USERS" && !(data.visibleUserIds && data.visibleUserIds.length > 0)) {
      return NextResponse.json(
        { error: "Belirli kullanıcılar görünürlüğü için en az bir kullanıcı seçin." },
        { status: 400 },
      );
    }
    if (data.visibility === "DEPARTMENT" && !data.departmentId) {
      return NextResponse.json(
        { error: "Departman görünürlüğü için bir departman seçin." },
        { status: 400 },
      );
    }

    // Kur çözümleme — TRY için her zaman 1; diğerlerinde açıkça verilmişse
    // onu, yoksa en güncel admin kurunu kullanır (bkz. proje talebi §8).
    let rateToTry: number;
    if (currency.isBase) {
      rateToTry = 1;
    } else if (data.rateToTry) {
      rateToTry = data.rateToTry;
    } else {
      const current = await getCurrentRate(currency.id, false);
      if (current === null) {
        return NextResponse.json(
          {
            error: `${currency.code} için tanımlı bir kur yok. Lütfen kaydı oluştururken bir kur belirtin veya admin panelinden kur girin.`,
          },
          { status: 400 },
        );
      }
      rateToTry = current;
    }

    const amountTry = computeAmountTry(data.amount, rateToTry);
    const transactionDate = new Date(`${data.transactionDate}T00:00:00.000Z`);
    if (Number.isNaN(transactionDate.getTime()) || transactionDate.getUTCFullYear() < 2000) {
      return NextResponse.json({ error: "Geçersiz işlem tarihi." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let recurringTemplateId: string | undefined;

      if (data.isRecurring && data.recurrence) {
        const template = await tx.financeRecurringTemplate.create({
          data: {
            type: data.type,
            amount: data.amount,
            currencyId: currency.id,
            categoryId: category.id,
            description: data.description ?? undefined,
            personId: data.personId,
            payeeName: data.payeeName ?? undefined,
            paymentMethod: data.paymentMethod ?? undefined,
            bankAccount: data.bankAccount ?? undefined,
            visibility: data.visibility ?? "OWNER_AND_ADMIN",
            departmentId: data.departmentId ?? undefined,
            frequency: data.recurrence.frequency,
            customIntervalDays: data.recurrence.customIntervalDays ?? undefined,
            startDate: transactionDate,
            endDate: data.recurrence.endDate ? new Date(`${data.recurrence.endDate}T00:00:00.000Z`) : undefined,
            nextOccurrenceDate: addRecurrencePeriod(
              transactionDate,
              data.recurrence.frequency,
              data.recurrence.customIntervalDays,
            ),
            lastGeneratedAt: new Date(),
            createdById: session.user.id,
          },
        });
        recurringTemplateId = template.id;
      }

      const transaction = await tx.financeTransaction.create({
        data: {
          type: data.type,
          transactionDate,
          amount: data.amount,
          currencyId: currency.id,
          rateToTry,
          amountTry,
          categoryId: category.id,
          description: data.description ?? undefined,
          personId: data.personId,
          payeeName: data.payeeName ?? undefined,
          paymentMethod: data.paymentMethod ?? undefined,
          bankAccount: data.bankAccount ?? undefined,
          receiptNumber: data.receiptNumber ?? undefined,
          status: data.status ?? "PAID",
          visibility: data.visibility ?? "OWNER_AND_ADMIN",
          departmentId: data.departmentId ?? undefined,
          isRecurring: !!data.isRecurring,
          recurringTemplateId,
          note: data.note ?? undefined,
          createdById: session.user.id,
          visibleUsers:
            data.visibility === "SPECIFIC_USERS" && data.visibleUserIds
              ? { create: data.visibleUserIds.map((userId) => ({ userId })) }
              : undefined,
          tags: data.tagIds?.length ? { create: data.tagIds.map((tagId) => ({ tagId })) } : undefined,
        },
        include: transactionInclude,
      });

      await tx.financeChangeLog.create({
        data: { transactionId: transaction.id, changedById: session.user.id, action: "CREATED" },
      });

      return transaction;
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RECORD_CREATED",
      module: "FINANCE",
      message: `${data.type === "INCOME" ? "Gelir" : "Gider"} kaydı eklendi: "${category.name}" — ${data.amount} ${currency.code}.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ transaction: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
