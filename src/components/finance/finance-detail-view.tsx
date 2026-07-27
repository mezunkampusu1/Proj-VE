"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Pencil, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  formatDate,
  financePaymentMethodLabel,
  financeStatusLabel,
  financeStatusTone,
  financeVisibilityLabel,
} from "@/lib/utils";
import { FinanceTransactionModal } from "@/components/finance/finance-transaction-modal";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface TransactionDetail {
  id: string;
  type: "INCOME" | "EXPENSE";
  transactionDate: string;
  amount: string | number;
  rateToTry: string | number;
  amountTry: string | number;
  description: string | null;
  payeeName: string | null;
  paymentMethod: string | null;
  bankAccount: string | null;
  receiptNumber: string | null;
  status: string;
  visibility: string;
  note: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  currency: { code: string; symbol: string };
  category: { name: string };
  department: { name: string } | null;
  person: { id: string; name: string | null; email: string };
  createdBy: { id: string; name: string | null; email: string };
  lastEditedBy: { id: string; name: string | null; email: string } | null;
  visibleUsers: { user: { id: string; name: string | null; email: string } }[];
  attachments: { id: string; fileName: string; fileSize: number; createdAt: string }[];
  tags: { tag: { id: string; name: string; color: string | null } }[];
  changeLogs: {
    id: string;
    action: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    changedAt: string;
    changedBy: { name: string | null; email: string };
  }[];
}

const FIELD_LABELS: Record<string, string> = {
  type: "Tür",
  transactionDate: "İşlem Tarihi",
  amount: "Tutar",
  currencyCode: "Para Birimi",
  categoryName: "Kategori",
  description: "Açıklama",
  payeeName: "Firma/Kişi",
  paymentMethod: "Ödeme Yöntemi",
  status: "Durum",
  visibility: "Görünürlük",
  note: "Not",
};

function formatAmount(n: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
}

export function FinanceDetailView({ transactionId, currentUserId, members }: { transactionId: string; currentUserId: string; members: MemberOption[] }) {
  const router = useRouter();
  const [data, setData] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/finance/transactions/${transactionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Kayıt bulunamadı.");
        }
        return res.json();
      })
      .then((d) => setData(d.transaction))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [transactionId]);

  async function markAsPaid() {
    setMarkingPaid(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/finance/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setActionError(d?.error ?? "Durum güncellenemedi.");
        return;
      }
      load();
      router.refresh();
    } finally {
      setMarkingPaid(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  if (error || !data) return <p className="text-sm text-destructive">{error ?? "Kayıt bulunamadı."}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={data.type === "EXPENSE" ? "red" : "green"}>{data.type === "EXPENSE" ? "Gider" : "Gelir"}</Badge>
              <h2 className="text-lg font-semibold text-foreground">{data.category.name}</h2>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(data.transactionDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(data.status === "PENDING" || data.status === "PARTIALLY_PAID") && (
            <Button type="button" size="sm" onClick={markAsPaid} disabled={markingPaid}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {markingPaid ? "İşaretleniyor..." : "Ödendi Olarak İşaretle"}
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Düzenle
          </Button>
        </div>
      </div>

      {actionError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Tutar</p>
            <p className="mt-0.5 text-xl font-semibold text-foreground">
              {formatAmount(Number(data.amount))} {data.currency.code}
            </p>
            {data.currency.code !== "TRY" && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                TL karşılığı: {formatAmount(Number(data.amountTry))} TL (kur: {formatAmount(Number(data.rateToTry))})
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Durum</p>
            <Badge tone={financeStatusTone[data.status] ?? "slate"} className="mt-1.5">
              {financeStatusLabel(data.status)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Görünürlük</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{financeVisibilityLabel(data.visibility)}</p>
            {data.department && <p className="text-xs text-muted-foreground">{data.department.name}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kayıt Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <InfoRow label="Kişi">
            <Link href={`/finance/person/${data.person.id}`} className="text-primary hover:underline">
              {data.person.name || data.person.email}
            </Link>
          </InfoRow>
          <InfoRow label="Ödemeyi Alan Kişi/Firma">{data.payeeName || "—"}</InfoRow>
          <InfoRow label="Ödeme Yöntemi">{financePaymentMethodLabel(data.paymentMethod)}</InfoRow>
          <InfoRow label="İlgili Banka/Hesap">{data.bankAccount || "—"}</InfoRow>
          <InfoRow label="Fiş/Fatura Numarası">{data.receiptNumber || "—"}</InfoRow>
          <InfoRow label="Tekrarlayan İşlem">{data.isRecurring ? "Evet" : "Hayır"}</InfoRow>
          {data.description && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Açıklama</p>
              <p className="mt-0.5 text-sm text-foreground/90">{data.description}</p>
            </div>
          )}
          {data.note && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Not</p>
              <p className="mt-0.5 text-sm text-foreground/90">{data.note}</p>
            </div>
          )}
          {data.tags.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">Etiketler</p>
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((t) => (
                  <Badge key={t.tag.id} tone="slate">
                    #{t.tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Belgeler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {data.attachments.length === 0 && <p className="text-sm text-muted-foreground">Belge yüklenmemiş.</p>}
          {data.attachments.map((a) => (
            <a
              key={a.id}
              href={`/api/finance/transactions/${transactionId}/attachments/${a.id}/download`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-accent/40"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground/90">{a.fileName}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{Math.round(a.fileSize / 1024)} KB</span>
            </a>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oluşturma / Düzenleme</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <InfoRow label="Kaydı Oluşturan">
            <span className="flex items-center gap-1.5">
              <Avatar name={data.createdBy.name} email={data.createdBy.email} size={18} />
              {data.createdBy.name || data.createdBy.email}
            </span>
          </InfoRow>
          <InfoRow label="Oluşturulma Tarihi">{formatDate(data.createdAt)}</InfoRow>
          <InfoRow label="Son Düzenleyen">
            {data.lastEditedBy ? data.lastEditedBy.name || data.lastEditedBy.email : "—"}
          </InfoRow>
          <InfoRow label="Son Düzenleme Tarihi">{formatDate(data.updatedAt)}</InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Değişiklik Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {data.changeLogs.length === 0 && <p className="text-sm text-muted-foreground">Henüz değişiklik yok.</p>}
          {data.changeLogs.map((log) => (
            <div key={log.id} className="text-sm">
              <p className="text-foreground/90">
                <span className="font-medium">{log.changedBy.name || log.changedBy.email}</span>
                {log.field ? (
                  <>
                    {" "}
                    — {FIELD_LABELS[log.field] ?? log.field}: <span className="text-muted-foreground">{log.oldValue ?? "—"}</span>{" "}
                    → <span className="text-foreground">{log.newValue ?? "—"}</span>
                  </>
                ) : (
                  <> — {log.action === "CREATED" ? "kaydı oluşturdu" : log.action === "DELETED" ? "kaydı sildi" : "güncelledi"}</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(log.changedAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <FinanceTransactionModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          load();
          router.refresh();
        }}
        transactionId={transactionId}
        currentUserId={currentUserId}
        members={members}
      />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground/90">{children}</p>
    </div>
  );
}
