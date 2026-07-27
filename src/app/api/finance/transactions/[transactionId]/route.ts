import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFinanceTransactionSchema } from "@/lib/validations";
import { requireTeamMember, NotFoundError, PermissionError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { logActivity, getClientIp } from "@/lib/activity";
import {
  resolveFinancePermissions,
  assertPermission,
  canViewTransaction,
} from "@/lib/finance-permissions";
import { getCurrentRate, computeAmountTry } from "@/lib/finance";
import type { Prisma } from "@prisma/client";

interface Params {
  params: Promise<{ transactionId: string }>;
}

const transactionInclude = {
  currency: { select: { id: true, code: true, name: true, symbol: true, decimalPlaces: true } },
  category: { select: { id: true, name: true, type: true, parentCategoryId: true } },
  person: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  lastEditedBy: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true } },
  visibleUsers: { include: { user: { select: { id: true, name: true, email: true } } } },
  attachments: { orderBy: { createdAt: "desc" } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  changeLogs: {
    include: { changedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { changedAt: "desc" },
  },
} satisfies Prisma.FinanceTransactionInclude;

async function loadAndAuthorize(transactionId: string, userId: string) {
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await requireTeamMember(workspace.id, userId);
  const permissions = await resolveFinancePermissions(userId, membership.role);
  assertPermission(permissions.canViewFinance, "Finans sayfasını görüntüleme yetkiniz yok.");

  const transaction = await prisma.financeTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: transactionInclude,
  });
  if (!transaction) throw new NotFoundError("Finans kaydı bulunamadı.");

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  const canView = canViewTransaction(transaction, userId, membership.role, permissions, me?.departmentId ?? null);
  if (!canView) throw new PermissionError("Bu finans kaydını görüntüleme yetkiniz yok.");

  return { workspace, membership, permissions, transaction };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { transactionId } = await params;
    const { transaction } = await loadAndAuthorize(transactionId, session.user.id);

    return NextResponse.json({ transaction });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { transactionId } = await params;
    const { workspace, permissions, transaction } = await loadAndAuthorize(transactionId, session.user.id);

    const isOwner = transaction.createdById === session.user.id || transaction.personId === session.user.id;
    const canEdit = permissions.canEditAllRecords || (permissions.canEditOwnRecords && isOwner);
    assertPermission(canEdit, "Bu kaydı düzenleme yetkiniz yok.");

    const body = await req.json();
    const data = updateFinanceTransactionSchema.parse(body);

    if (data.currencyId && data.currencyId !== transaction.currencyId) {
      const found = await prisma.financeCurrency.findUnique({ where: { id: data.currencyId } });
      if (!found || !found.isActive) throw new NotFoundError("Para birimi bulunamadı.");
    }

    let category = transaction.category;
    if (data.categoryId && data.categoryId !== transaction.categoryId) {
      const found = await prisma.financeCategory.findUnique({ where: { id: data.categoryId } });
      if (!found || !found.isActive) throw new NotFoundError("Kategori bulunamadı.");
      category = found;
    }
    const nextType = data.type ?? transaction.type;
    if (category.type !== nextType) {
      return NextResponse.json({ error: "Kategori türü, kayıt türüyle uyuşmuyor." }, { status: 400 });
    }

    if (data.personId) {
      await requireTeamMember(workspace.id, data.personId).catch(() => {
        throw new PermissionError("Seçilen kişi bu ekibin üyesi değil.");
      });
    }

    const amount = data.amount ?? Number(transaction.amount);
    let rateToTry = Number(transaction.rateToTry);
    const currencyChanged = !!data.currencyId && data.currencyId !== transaction.currencyId;
    if (currencyChanged || data.rateToTry) {
      const targetCurrencyId = data.currencyId ?? transaction.currencyId;
      const currencyRow = await prisma.financeCurrency.findUnique({ where: { id: targetCurrencyId } });
      if (!currencyRow || !currencyRow.isActive) throw new NotFoundError("Para birimi bulunamadı.");

      if (currencyRow.isBase) {
        rateToTry = 1;
      } else if (data.rateToTry) {
        rateToTry = data.rateToTry;
      } else {
        const current = await getCurrentRate(currencyRow.id, false);
        if (current === null) {
          return NextResponse.json({ error: `${currencyRow.code} için tanımlı bir kur yok.` }, { status: 400 });
        }
        rateToTry = current;
      }
    }
    const amountTry = computeAmountTry(amount, rateToTry);

    const transactionDate = data.transactionDate
      ? new Date(`${data.transactionDate}T00:00:00.000Z`)
      : transaction.transactionDate;

    const before = {
      type: transaction.type,
      transactionDate: transaction.transactionDate.toISOString().slice(0, 10),
      amount: Number(transaction.amount),
      currencyCode: transaction.currency.code,
      categoryName: transaction.category.name,
      description: transaction.description,
      payeeName: transaction.payeeName,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      visibility: transaction.visibility,
      note: transaction.note,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.financeTransaction.update({
        where: { id: transactionId },
        data: {
          type: data.type,
          transactionDate,
          amount,
          currencyId: data.currencyId,
          rateToTry,
          amountTry,
          categoryId: data.categoryId,
          description: data.description,
          personId: data.personId,
          payeeName: data.payeeName,
          paymentMethod: data.paymentMethod,
          bankAccount: data.bankAccount,
          receiptNumber: data.receiptNumber,
          status: data.status,
          visibility: data.visibility,
          departmentId: data.departmentId,
          note: data.note,
          lastEditedById: session.user.id,
          ...(data.visibleUserIds
            ? {
                visibleUsers: {
                  deleteMany: {},
                  create: data.visibleUserIds.map((userId) => ({ userId })),
                },
              }
            : {}),
          ...(data.tagIds
            ? { tags: { deleteMany: {}, create: data.tagIds.map((tagId) => ({ tagId })) } }
            : {}),
        },
        include: transactionInclude,
      });

      const after = {
        type: result.type,
        transactionDate: result.transactionDate.toISOString().slice(0, 10),
        amount: Number(result.amount),
        currencyCode: result.currency.code,
        categoryName: result.category.name,
        description: result.description,
        payeeName: result.payeeName,
        paymentMethod: result.paymentMethod,
        status: result.status,
        visibility: result.visibility,
        note: result.note,
      };

      const changeRows: { field: string; oldValue: string | null; newValue: string | null }[] = [];
      for (const key of Object.keys(after) as (keyof typeof after)[]) {
        const oldValue = before[key];
        const newValue = after[key];
        if (String(oldValue ?? "") !== String(newValue ?? "")) {
          changeRows.push({
            field: key,
            oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
            newValue: newValue === null || newValue === undefined ? null : String(newValue),
          });
        }
      }

      if (changeRows.length > 0) {
        await tx.financeChangeLog.createMany({
          data: changeRows.map((row) => ({
            transactionId,
            changedById: session.user.id,
            action: (row.field === "status" ? "STATUS_CHANGED" : "UPDATED") as
              | "STATUS_CHANGED"
              | "UPDATED",
            field: row.field,
            oldValue: row.oldValue,
            newValue: row.newValue,
          })),
        });
      }

      return result;
    });

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RECORD_UPDATED",
      module: "FINANCE",
      message: `"${updated.category.name}" finans kaydı güncellendi.`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ transaction: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Soft delete — kayıt kalıcı silinmez, `deletedAt` işaretlenir (bkz. proje talebi §12). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { transactionId } = await params;
    const { workspace, permissions, transaction } = await loadAndAuthorize(transactionId, session.user.id);

    assertPermission(permissions.canDeleteRecords, "Finans kaydı silme yetkiniz yok.");

    await prisma.$transaction([
      prisma.financeTransaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() },
      }),
      prisma.financeChangeLog.create({
        data: { transactionId, changedById: session.user.id, action: "DELETED" },
      }),
    ]);

    await logActivity({
      teamId: workspace.id,
      userId: session.user.id,
      action: "FINANCE_RECORD_DELETED",
      module: "FINANCE",
      message: `"${transaction.category.name}" finans kaydı silindi.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
