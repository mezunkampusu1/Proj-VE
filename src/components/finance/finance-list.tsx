"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Paperclip, Download, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import {
  formatDate,
  financePaymentMethodLabel,
  financeStatusLabel,
  financeStatusTone,
  financeVisibilityLabel,
} from "@/lib/utils";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}
interface CategoryOption {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}
interface CurrencyOption {
  id: string;
  code: string;
  symbol: string;
}

interface TransactionRow {
  id: string;
  type: "INCOME" | "EXPENSE";
  transactionDate: string;
  amount: string | number;
  amountTry: string | number;
  description: string | null;
  payeeName: string | null;
  paymentMethod: string | null;
  status: string;
  visibility: string;
  currency: { code: string; symbol: string };
  category: { name: string };
  person: { id: string; name: string | null; email: string };
  createdBy: { id: string; name: string | null; email: string };
  attachments: { id: string }[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10);
}
function firstOfYearIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), 0, 1)).toISOString().slice(0, 10);
}
function firstOfWeekIso() {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

type QuickRange = "all" | "today" | "week" | "month" | "year";

function formatNumber(n: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
}

export function FinanceList({
  onEdit,
  members,
  categories,
  currencies,
  refreshKey,
}: {
  onEdit: (id: string) => void;
  members: MemberOption[];
  categories: CategoryOption[];
  currencies: CurrencyOption[];
  refreshKey: number;
}) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState("");
  const [visibility, setVisibility] = useState("");
  const [hasDocument, setHasDocument] = useState("");
  const [quickRange, setQuickRange] = useState<QuickRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function rangeParams() {
    if (quickRange === "today") return { from: todayIso(), to: todayIso() };
    if (quickRange === "week") return { from: firstOfWeekIso(), to: todayIso() };
    if (quickRange === "month") return { from: firstOfMonthIso(), to: todayIso() };
    if (quickRange === "year") return { from: firstOfYearIso(), to: todayIso() };
    return { from: customFrom, to: customTo };
  }

  function buildParams(noLimit: boolean) {
    const { from, to } = rangeParams();
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    if (personId) params.set("personId", personId);
    if (categoryId) params.set("categoryId", categoryId);
    if (currencyId) params.set("currencyId", currencyId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (status) params.set("status", status);
    if (visibility) params.set("visibility", visibility);
    if (hasDocument) params.set("hasDocument", hasDocument);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (noLimit) params.set("noLimit", "1");
    return params;
  }

  function load() {
    setLoading(true);
    fetch(`/api/finance/transactions?${buildParams(false).toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.transactions ?? []);
        setTotal(data.total ?? 0);
        setHasMore(!!data.hasMore);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, personId, categoryId, currencyId, paymentMethod, status, visibility, hasDocument, quickRange, customFrom, customTo, page, refreshKey]);

  useEffect(() => setPage(1), [q, type, personId, categoryId, currencyId, paymentMethod, status, visibility, hasDocument, quickRange, customFrom, customTo]);

  // Kullanıcı talebi: liste F5 atmadan gelsin.
  useLiveRefresh(load, 10000);

  async function exportCsv() {
    setExporting(true);
    const res = await fetch(`/api/finance/transactions?${buildParams(true).toString()}`);
    const data = await res.json();
    const allRows: TransactionRow[] = data.transactions ?? [];

    const header = [
      "Tarih",
      "Tür",
      "Açıklama",
      "Kategori",
      "Kişi",
      "Firma/Kişi",
      "Tutar",
      "Para Birimi",
      "TL Karşılığı",
      "Ödeme Yöntemi",
      "Durum",
      "Görünürlük",
      "Belge",
      "Kaydı Oluşturan",
    ];
    const csvRows = allRows.map((r) => [
      r.transactionDate.slice(0, 10),
      r.type === "INCOME" ? "Gelir" : "Gider",
      r.description ?? "",
      r.category.name,
      r.person.name || r.person.email,
      r.payeeName ?? "",
      String(r.amount),
      r.currency.code,
      String(r.amountTry),
      financePaymentMethodLabel(r.paymentMethod),
      financeStatusLabel(r.status),
      financeVisibilityLabel(r.visibility),
      r.attachments.length > 0 ? "Var" : "Yok",
      r.createdBy.name || r.createdBy.email,
    ]);

    const csv = [header, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finans-kayitlari-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { value: "all", label: "Tümü" },
            { value: "today", label: "Bugün" },
            { value: "week", label: "Bu Hafta" },
            { value: "month", label: "Bu Ay" },
            { value: "year", label: "Bu Yıl" },
          ] as const
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setQuickRange(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              quickRange === f.value
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara: açıklama, kişi, firma, fiş no..." className="w-full sm:w-56" />
          <SimpleSelect
            value={type}
            onValueChange={setType}
            placeholder="Gelir/Gider"
            triggerClassName="w-36"
            options={[{ value: "", label: "Tümü" }, { value: "EXPENSE", label: "Gider" }, { value: "INCOME", label: "Gelir" }]}
          />
          <SimpleSelect
            value={personId}
            onValueChange={setPersonId}
            placeholder="Kişi"
            triggerClassName="w-40"
            options={[{ value: "", label: "Tüm kişiler" }, ...members.map((m) => ({ value: m.id, label: m.name || m.email }))]}
          />
          <SimpleSelect
            value={categoryId}
            onValueChange={setCategoryId}
            placeholder="Kategori"
            triggerClassName="w-44"
            options={[{ value: "", label: "Tüm kategoriler" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <SimpleSelect
            value={currencyId}
            onValueChange={setCurrencyId}
            placeholder="Para Birimi"
            triggerClassName="w-32"
            options={[{ value: "", label: "Tümü" }, ...currencies.map((c) => ({ value: c.id, label: c.code }))]}
          />
          <SimpleSelect
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            placeholder="Ödeme Yöntemi"
            triggerClassName="w-40"
            options={[
              { value: "", label: "Tümü" },
              { value: "CASH", label: "Nakit" },
              { value: "CREDIT_CARD", label: "Kredi Kartı" },
              { value: "BANK_TRANSFER", label: "Banka Havalesi" },
              { value: "AUTOMATIC_PAYMENT", label: "Otomatik Ödeme" },
              { value: "OTHER", label: "Diğer" },
            ]}
          />
          <SimpleSelect
            value={status}
            onValueChange={setStatus}
            placeholder="Durum"
            triggerClassName="w-36"
            options={[
              { value: "", label: "Tümü" },
              { value: "PAID", label: "Ödendi" },
              { value: "PENDING", label: "Bekliyor" },
              { value: "PARTIALLY_PAID", label: "Kısmen Ödendi" },
              { value: "CANCELLED", label: "İptal Edildi" },
            ]}
          />
          <SimpleSelect
            value={visibility}
            onValueChange={setVisibility}
            placeholder="Görünürlük"
            triggerClassName="w-40"
            options={[
              { value: "", label: "Tümü" },
              { value: "ADMIN_ONLY", label: "Sadece adminler" },
              { value: "OWNER_AND_ADMIN", label: "Oluşturan ve adminler" },
              { value: "SPECIFIC_USERS", label: "Seçilen kullanıcılar" },
              { value: "DEPARTMENT", label: "İlgili departman" },
              { value: "TEAM", label: "Tüm ekip" },
            ]}
          />
          <SimpleSelect
            value={hasDocument}
            onValueChange={setHasDocument}
            placeholder="Belge"
            triggerClassName="w-40"
            options={[
              { value: "", label: "Tümü" },
              { value: "1", label: "Belgesi olanlar" },
              { value: "0", label: "Belgesi olmayanlar" },
            ]}
          />
          {quickRange === "all" && (
            <div className="flex items-center gap-1.5">
              <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="Başlangıç" className="w-36" />
              <span className="text-xs text-muted-foreground">—</span>
              <DatePicker value={customTo} onChange={setCustomTo} placeholder="Bitiş" className="w-36" />
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{total} kayıt</span>
            <Button type="button" variant="secondary" size="sm" onClick={exportCsv} disabled={exporting}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? "Aktarılıyor..." : "CSV Aktar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          <table className="w-full min-w-[1400px] table-fixed text-sm">
            <colgroup>
              <col className="w-[100px]" />
              <col className="w-[70px]" />
              <col className="w-[200px]" />
              <col className="w-[140px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[110px]" />
              <col className="w-[130px]" />
              <col className="w-[110px]" />
              <col className="w-[140px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="truncate px-3 py-2 pl-0 font-medium">Tarih</th>
                <th className="truncate px-3 py-2 font-medium">Tür</th>
                <th className="truncate px-3 py-2 font-medium">Açıklama</th>
                <th className="truncate px-3 py-2 font-medium">Kategori</th>
                <th className="truncate px-3 py-2 font-medium">Kişi</th>
                <th className="truncate px-3 py-2 font-medium">Firma/Kişi</th>
                <th className="truncate px-3 py-2 font-medium">Tutar</th>
                <th className="truncate px-3 py-2 font-medium">TL Karşılığı</th>
                <th className="truncate px-3 py-2 font-medium">Ödeme</th>
                <th className="truncate px-3 py-2 font-medium">Durum</th>
                <th className="truncate px-3 py-2 font-medium">Belge</th>
                <th className="px-3 py-2 pr-0 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => onEdit(r.id)}>
                  <td className="whitespace-nowrap px-3 py-2.5 pl-0 align-middle text-xs text-muted-foreground">
                    {formatDate(r.transactionDate)}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <Badge tone={r.type === "EXPENSE" ? "red" : "green"}>{r.type === "EXPENSE" ? "Gider" : "Gelir"}</Badge>
                  </td>
                  <td className="truncate px-3 py-2.5 align-middle text-foreground/90" title={r.description ?? undefined}>
                    {r.description || "—"}
                  </td>
                  <td className="truncate px-3 py-2.5 align-middle text-muted-foreground">{r.category.name}</td>
                  <td className="truncate px-3 py-2.5 align-middle text-muted-foreground">
                    <Link
                      href={`/finance/person/${r.person.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-primary hover:underline"
                    >
                      {r.person.name || r.person.email}
                    </Link>
                  </td>
                  <td className="truncate px-3 py-2.5 align-middle text-muted-foreground">{r.payeeName || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle font-medium text-foreground">
                    {formatNumber(Number(r.amount))} {r.currency.code}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                    {formatNumber(Number(r.amountTry))} TL
                  </td>
                  <td className="truncate px-3 py-2.5 align-middle text-xs text-muted-foreground">
                    {financePaymentMethodLabel(r.paymentMethod)}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <Badge tone={financeStatusTone[r.status] ?? "slate"}>{financeStatusLabel(r.status)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 align-middle text-center">
                    {r.attachments.length > 0 && <Paperclip className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}
                  </td>
                  <td className="px-3 py-2.5 pr-0 align-middle text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(r.id);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Düzenle"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                    Bu filtreye uyan kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Önceki
        </Button>
        <span className="text-xs text-muted-foreground">Sayfa {page}</span>
        <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
          Sonraki <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
