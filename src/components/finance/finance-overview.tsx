"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  TrendingDown,
  TrendingUp,
  User,
  Tag,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, financeStatusLabel, financeStatusTone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface CurrencyTotal {
  currencyId: string;
  code: string;
  symbol: string;
  total: number;
}

interface PaymentRow {
  id: string;
  transactionDate: string;
  amount: string | number;
  status: string;
  currency: { code: string; symbol: string };
  category: { name: string };
  person: { id: string; name: string | null; email: string };
}

interface SummaryResponse {
  expenseByCurrency: CurrencyTotal[];
  incomeByCurrency: CurrencyTotal[];
  totalExpenseTry: number;
  totalIncomeTry: number;
  netTry: number;
  thisMonthExpenseTry: number;
  lastMonthExpenseTry: number;
  monthOverMonthChangePct: number | null;
  topSpender: { id: string; name: string | null; email: string; totalTry: number } | null;
  topCategory: { id: string; name: string; totalTry: number } | null;
  pendingCount: number;
  upcomingTotalTry: number;
  upcoming: PaymentRow[];
  overdue: PaymentRow[];
}

function formatAmountList(items: CurrencyTotal[]) {
  if (items.length === 0) return "—";
  return items.map((i) => `${formatNumber(i.total)} ${i.code}`).join(" · ");
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
}

function formatTry(n: number) {
  return `${formatNumber(n)} TL`;
}

export function FinanceOverview({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/finance/summary")
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [refreshKey]);

  // Kullanıcı talebi: özet kartları F5 atmadan gelsin.
  useLiveRefresh(load, 15000);

  if (loading || !summary) {
    return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  }

  const changeUp = (summary.monthOverMonthChangePct ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={ArrowDownCircle}
          tone="red"
          label="Toplam Gider"
          value={formatAmountList(summary.expenseByCurrency)}
          sub={`TL karşılığı: ${formatTry(summary.totalExpenseTry)}`}
        />
        <SummaryCard
          icon={ArrowUpCircle}
          tone="green"
          label="Toplam Gelir"
          value={formatAmountList(summary.incomeByCurrency)}
          sub={`TL karşılığı: ${formatTry(summary.totalIncomeTry)}`}
        />
        <SummaryCard
          icon={Scale}
          tone={summary.netTry >= 0 ? "green" : "red"}
          label="Net Bakiye (TL karşılığı)"
          value={formatTry(summary.netTry)}
        />
        <SummaryCard
          icon={changeUp ? TrendingUp : TrendingDown}
          tone={changeUp ? "red" : "green"}
          label="Bu Ay Yapılan Toplam Harcama"
          value={formatTry(summary.thisMonthExpenseTry)}
          sub={
            summary.monthOverMonthChangePct === null
              ? "Geçen ay veri yok"
              : `Geçen aya göre ${changeUp ? "+" : ""}${summary.monthOverMonthChangePct}%`
          }
        />
        {summary.topSpender ? (
          <Link href={`/finance/person/${summary.topSpender.id}`}>
            <SummaryCard
              icon={User}
              tone="blue"
              label="En Fazla Harcama Yapan Kişi"
              value={summary.topSpender.name || summary.topSpender.email}
              sub={formatTry(summary.topSpender.totalTry)}
              clickable
            />
          </Link>
        ) : (
          <SummaryCard icon={User} tone="blue" label="En Fazla Harcama Yapan Kişi" value="—" />
        )}
        <SummaryCard
          icon={Tag}
          tone="amber"
          label="En Fazla Harcama Yapılan Kategori"
          value={summary.topCategory ? summary.topCategory.name : "—"}
          sub={summary.topCategory ? formatTry(summary.topCategory.totalTry) : undefined}
        />
        <SummaryCard icon={Clock} tone="amber" label="Bekleyen Ödeme Sayısı" value={String(summary.pendingCount)} />
        <SummaryCard
          icon={AlertTriangle}
          tone="red"
          label="Yaklaşan Ödeme Toplamı (30 gün, TL karşılığı)"
          value={formatTry(summary.upcomingTotalTry)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentListCard title="Yaklaşan Ödemeler" tone="amber" rows={summary.upcoming} emptyText="Yaklaşan ödeme yok." />
        <PaymentListCard title="Geciken Ödemeler" tone="red" rows={summary.overdue} emptyText="Geciken ödeme yok." />
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  clickable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "red" | "green" | "amber" | "slate";
  label: string;
  value: string;
  sub?: string;
  clickable?: boolean;
}) {
  return (
    <Card className={clickable ? "transition-colors hover:border-primary/40" : undefined}>
      <CardContent className="flex items-start gap-3 pt-5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-${tone} text-tint-${tone}-foreground`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentListCard({
  title,
  tone,
  rows,
  emptyText,
}: {
  title: string;
  tone: "amber" | "red";
  rows: PaymentRow[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/finance/${r.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.category.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.person.name || r.person.email} · {formatDate(r.transactionDate)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("text-sm font-semibold", tone === "red" ? "text-destructive" : "text-tint-amber-foreground")}>
                {formatNumber(Number(r.amount))} {r.currency.code}
              </span>
              <Badge tone={financeStatusTone[r.status] ?? "slate"}>{financeStatusLabel(r.status)}</Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
