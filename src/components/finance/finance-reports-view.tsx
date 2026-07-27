"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { formatDate, financeStatusLabel, financeStatusTone, financeRecurrenceFrequencyLabel } from "@/lib/utils";

const CHART_COLORS = ["var(--primary)", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#a78bfa", "#fb923c", "#4ade80", "#f87171", "#38bdf8"];

const RANGE_OPTIONS = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" },
  { value: "custom", label: "Özel Aralık" },
];

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
}
function fmtTry(n: number) {
  return `${fmt(n)} TL`;
}
function truncateLabel(label: string, max = 14) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

interface CategoryRow { categoryId: string; name: string; type: string; totalTry: number; count: number }
interface PersonRow { personId: string; name: string; totalTry: number; count: number }
interface PayeeRow { payeeName: string; totalTry: number; count: number }
interface CurrencyRow { currencyId: string; code: string; symbol: string; totalTry: number; count: number }
interface PaymentMethodRow { method: string; label: string; totalTry: number; count: number }
interface TimeSeriesRow { bucket: string; incomeTry: number; expenseTry: number }
interface TransactionLite {
  id: string;
  transactionDate: string;
  amount: string | number;
  amountTry: string | number;
  status?: string;
  currency: { code: string; symbol?: string };
  category: { name: string };
  person: { id: string; name: string | null; email: string };
  payeeName?: string | null;
}
interface RecurringRow {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  frequency: string;
  nextOccurrenceDate: string;
  currency: { code: string };
  category: { name: string };
  person: { id: string; name: string | null; email: string };
}

interface ReportResponse {
  range: { type: string; start: string; end: string; granularity: string };
  totals: { incomeTry: number; expenseTry: number; netTry: number; recordCount: number };
  timeSeries: TimeSeriesRow[];
  byCategory: CategoryRow[];
  byPerson: PersonRow[];
  byPayee: PayeeRow[];
  byCurrency: CurrencyRow[];
  byPaymentMethod: PaymentMethodRow[];
  topExpenses: TransactionLite[];
  pendingPayments: TransactionLite[];
  recurringExpenses: RecurringRow[];
  periodComparison: {
    current: { incomeTry: number; expenseTry: number; netTry: number };
    previous: { incomeTry: number; expenseTry: number; netTry: number };
    changePct: { income: number | null; expense: number | null; net: number | null };
  };
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-tint-red-foreground" : pct < 0 ? "text-tint-green-foreground" : "text-muted-foreground"}`}>
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export function FinanceReportsView() {
  const [range, setRange] = useState("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (range === "custom" && (!from || !to)) return;
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    fetch(`/api/finance/reports?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Rapor yüklenemedi.");
        }
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range, from, to]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="min-w-[160px] space-y-1.5">
            <Label className="text-xs text-muted-foreground">Zaman Aralığı</Label>
            <SimpleSelect value={range} onValueChange={setRange} options={RANGE_OPTIONS} />
          </div>
          {range === "custom" && (
            <>
              <div className="min-w-[140px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Başlangıç</Label>
                <DatePicker value={from} onChange={setFrom} />
              </div>
              <div className="min-w-[140px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bitiş</Label>
                <DatePicker value={to} onChange={setTo} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && !data && <p className="text-sm text-muted-foreground">Rapor yükleniyor...</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Toplam Gelir (TL karşılığı)" value={fmtTry(data.totals.incomeTry)} change={data.periodComparison.changePct.income} />
            <StatCard label="Toplam Gider (TL karşılığı)" value={fmtTry(data.totals.expenseTry)} change={data.periodComparison.changePct.expense} />
            <StatCard label="Net Bakiye (TL karşılığı)" value={fmtTry(data.totals.netTry)} change={data.periodComparison.changePct.net} />
            <StatCard label="Kayıt Sayısı" value={String(data.totals.recordCount)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dönem Karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <ComparisonRow label="Gelir" curr={data.periodComparison.current.incomeTry} prev={data.periodComparison.previous.incomeTry} pct={data.periodComparison.changePct.income} />
                <ComparisonRow label="Gider" curr={data.periodComparison.current.expenseTry} prev={data.periodComparison.previous.expenseTry} pct={data.periodComparison.changePct.expense} />
                <ComparisonRow label="Net" curr={data.periodComparison.current.netTry} prev={data.periodComparison.previous.netTry} pct={data.periodComparison.changePct.net} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Karşılaştırma, seçilen dönemle eşit uzunluktaki bir önceki döneme göre yapılır.</p>
            </CardContent>
          </Card>

          {/* Grafik 1: Zaman içinde gelir/gider */}
          <Card>
            <CardHeader>
              <CardTitle>Zaman İçinde Gelir / Gider</CardTitle>
            </CardHeader>
            <CardContent>
              {data.timeSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu dönemde veri yok.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTry(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="incomeTry" name="Gelir" stroke="#34d399" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenseTry" name="Gider" stroke="#f87171" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Grafik 2: Kategori dağılımı */}
            <Card>
              <CardHeader>
                <CardTitle>Kategori Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.byCategory.slice(0, 8)} dataKey="totalTry" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
                          {data.byCategory.slice(0, 8).map((c, i) => (
                            <Cell key={c.categoryId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTry(Number(v))} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grafik 5: Para birimi dağılımı */}
            <Card>
              <CardHeader>
                <CardTitle>Para Birimi Dağılımı (TL karşılığı)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byCurrency.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.byCurrency} dataKey="totalTry" nameKey="code" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
                          {data.byCurrency.map((c, i) => (
                            <Cell key={c.currencyId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTry(Number(v))} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Grafik 3: Kişi bazlı karşılaştırma */}
            <Card>
              <CardHeader>
                <CardTitle>Kişi Bazlı Harcama Karşılaştırması</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byPerson.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byPerson.map((p) => ({ ...p, name: truncateLabel(p.name) }))} margin={{ top: 5, right: 10, left: -20, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} angle={-35} textAnchor="end" interval={0} />
                        <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTry(Number(v))} />
                        <Bar dataKey="totalTry" name="Harcama" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grafik 4: Zaman içinde toplam harcama */}
            <Card>
              <CardHeader>
                <CardTitle>Zaman İçinde Toplam Harcama</CardTitle>
              </CardHeader>
              <CardContent>
                {data.timeSeries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.timeSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={10} />
                        <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTry(Number(v))} />
                        <Bar dataKey="expenseTry" name="Gider" fill="#f87171" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <ReportTable title="Kategoriye Göre" rows={data.byCategory} columns={[
            { key: "name", label: "Kategori" },
            { key: "type", label: "Tür", render: (r: CategoryRow) => (r.type === "EXPENSE" ? "Gider" : "Gelir") },
            { key: "count", label: "Kayıt" },
            { key: "totalTry", label: "Toplam (TL)", render: (r: CategoryRow) => fmtTry(r.totalTry) },
          ]} />

          <ReportTable title="Kişiye Göre" rows={data.byPerson} columns={[
            { key: "name", label: "Kişi" },
            { key: "count", label: "Kayıt" },
            { key: "totalTry", label: "Toplam (TL)", render: (r: PersonRow) => fmtTry(r.totalTry) },
          ]} />

          <ReportTable title="Firmaya Göre" rows={data.byPayee} columns={[
            { key: "payeeName", label: "Firma / Kişi" },
            { key: "count", label: "Kayıt" },
            { key: "totalTry", label: "Toplam (TL)", render: (r: PayeeRow) => fmtTry(r.totalTry) },
          ]} />

          <ReportTable title="Para Birimine Göre" rows={data.byCurrency} columns={[
            { key: "code", label: "Para Birimi" },
            { key: "count", label: "Kayıt" },
            { key: "totalTry", label: "TL Karşılığı", render: (r: CurrencyRow) => fmtTry(r.totalTry) },
          ]} />

          <ReportTable title="Ödeme Yöntemine Göre" rows={data.byPaymentMethod} columns={[
            { key: "label", label: "Ödeme Yöntemi" },
            { key: "count", label: "Kayıt" },
            { key: "totalTry", label: "Toplam (TL)", render: (r: PaymentMethodRow) => fmtTry(r.totalTry) },
          ]} />

          <Card>
            <CardHeader>
              <CardTitle>En Yüksek Harcamalar (İlk 10)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.topExpenses.length === 0 && <p className="text-sm text-muted-foreground">Bu dönemde gider yok.</p>}
              {data.topExpenses.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground/90">{t.category.name} — {t.person.name || t.person.email}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.transactionDate)}{t.payeeName ? ` · ${t.payeeName}` : ""}</p>
                  </div>
                  <span className="shrink-0 font-medium text-destructive">
                    {fmt(Number(t.amount))} {t.currency.code}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bekleyen Ödemeler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.pendingPayments.length === 0 && <p className="text-sm text-muted-foreground">Bekleyen ödeme yok.</p>}
              {data.pendingPayments.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground/90">{t.category.name} — {t.person.name || t.person.email}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.transactionDate)}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium text-foreground">{fmt(Number(t.amount))} {t.currency.code}</span>
                    {t.status && <Badge tone={financeStatusTone[t.status] ?? "slate"}>{financeStatusLabel(t.status)}</Badge>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tekrarlayan Giderler / Gelirler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.recurringExpenses.length === 0 && <p className="text-sm text-muted-foreground">Aktif tekrarlayan işlem yok.</p>}
              {data.recurringExpenses.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground/90">{r.category.name} — {r.person.name || r.person.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {financeRecurrenceFrequencyLabel(r.frequency)} · Sonraki: {formatDate(r.nextOccurrenceDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 font-medium ${r.type === "EXPENSE" ? "text-destructive" : "text-tint-green-foreground"}`}>
                    {fmt(Number(r.amount))} {r.currency.code}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, change }: { label: string; value: string; change?: number | null }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
        {change !== undefined && (
          <div className="mt-0.5">
            <ChangeBadge pct={change ?? null} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ label, curr, prev, pct }: { label: string; curr: number; prev: number; pct: number | null }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{fmtTry(curr)}</p>
      <p className="text-xs text-muted-foreground">Önceki dönem: {fmtTry(prev)}</p>
      <ChangeBadge pct={pct} />
    </div>
  );
}

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

function ReportTable<T>({ title, rows, columns }: { title: string; rows: T[]; columns: Column<T>[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu dönemde veri yok.</p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} className="truncate px-3 py-2 align-middle font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="truncate px-3 py-2 align-middle text-foreground/90">
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
