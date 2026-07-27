"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Paperclip, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, financeStatusLabel, financeStatusTone } from "@/lib/utils";

interface PersonSummary {
  person: { id: string; name: string | null; email: string; image: string | null };
  totals: { allTimeTry: number; dailyTry: number; weeklyTry: number; monthlyTry: number; yearlyTry: number };
  topCategory: { id: string; name: string; totalTry: number } | null;
  byPayee: { payeeName: string; totalTry: number }[];
  pendingPayments: {
    id: string;
    transactionDate: string;
    amount: string | number;
    status: string;
    currency: { code: string };
    category: { name: string };
  }[];
  recordCount: number;
  averageAmountTry: number;
  attachments: { id: string; fileName: string; createdAt: string; transaction: { id: string; category: { name: string } } }[];
}

function formatTry(n: number) {
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n)} TL`;
}

export function FinancePersonView({ userId }: { userId: string }) {
  const [data, setData] = useState<PersonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/persons/${userId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Yüklenemedi.");
        }
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  if (error || !data) return <p className="text-sm text-destructive">{error ?? "Kayıt bulunamadı."}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar name={data.person.name} email={data.person.email} size={36} />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{data.person.name || data.person.email}</h2>
          <p className="text-xs text-muted-foreground">{data.recordCount} kayıt · Ortalama {formatTry(data.averageAmountTry)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Toplam Harcama" value={formatTry(data.totals.allTimeTry)} />
        <StatCard label="Günlük" value={formatTry(data.totals.dailyTry)} />
        <StatCard label="Haftalık" value={formatTry(data.totals.weeklyTry)} />
        <StatCard label="Aylık" value={formatTry(data.totals.monthlyTry)} />
        <StatCard label="Yıllık" value={formatTry(data.totals.yearlyTry)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>En Fazla Harcama Yaptığı Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topCategory ? (
              <p className="text-sm text-foreground">
                {data.topCategory.name} — <span className="font-medium">{formatTry(data.topCategory.totalTry)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Firmalara Göre Harcama</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.byPayee.length === 0 && <p className="text-sm text-muted-foreground">Henüz veri yok.</p>}
            {data.byPayee.map((p) => (
              <div key={p.payeeName} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground/90">{p.payeeName}</span>
                <span className="shrink-0 font-medium text-foreground">{formatTry(p.totalTry)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bekleyen Ödemeleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.pendingPayments.length === 0 && <p className="text-sm text-muted-foreground">Bekleyen ödeme yok.</p>}
          {data.pendingPayments.map((p) => (
            <Link
              key={p.id}
              href={`/finance/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="text-foreground/90">
                {p.category.name} · {formatDate(p.transactionDate)}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {Number(p.amount).toLocaleString("tr-TR")} {p.currency.code}
                </span>
                <Badge tone={financeStatusTone[p.status] ?? "slate"}>{financeStatusLabel(p.status)}</Badge>
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yüklediği Fiş ve Faturalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {data.attachments.length === 0 && <p className="text-sm text-muted-foreground">Henüz belge yüklenmemiş.</p>}
          {data.attachments.map((a) => (
            <Link
              key={a.id}
              href={`/finance/${a.transaction.id}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-accent/40"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground/90">{a.fileName}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{a.transaction.category.name}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
