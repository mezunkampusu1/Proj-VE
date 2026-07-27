"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { contentStatusLabel, socialPlatformLabel } from "@/lib/utils";

interface ReportData {
  counts: { social: number; blog: number; seo: number };
  statusBreakdown: Record<"social" | "blog" | "seo", { status: string; count: number }[]>;
  platformBreakdown: { platform: string; count: number }[];
  performance: {
    publishedCount: number;
    totals: {
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      linkClicks: number;
      followerGain: number;
    };
    avgEngagementRate: number;
  };
  byPerson: { userId: string; name: string; contentCount: number }[];
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

const EXPORT_KINDS: { kind: string; label: string; endpoint: string }[] = [
  { kind: "social", label: "Sosyal Medya", endpoint: "/api/content/social" },
  { kind: "blog", label: "Blog & SEO", endpoint: "/api/content/blog" },
  { kind: "seo", label: "SEO Çalışmaları", endpoint: "/api/content/seo" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toCsv(header: string[], rows: (string | number)[][]) {
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** İçerik modülü raporlama/performans ekranı — bkz. proje talebi §9/§16. */
export function ContentReportsView() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportingKind, setExportingKind] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setLoading(true);
    fetch(`/api/content/reports?${params.toString()}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [from, to]);

  async function exportKind(kind: string, _label: string, endpoint: string) {
    setExportingKind(kind);
    type Row = { id: string; title: string; status: string; priority: string; createdBy: { name: string | null; email: string }; updatedAt: string };
    const allRows: Row[] = [];
    let page = 1;
    // Liste uç noktaları sayfa başına en fazla 100 kayıt döner — Finans
    // modülündeki dışa aktarma deseniyle AYNI şekilde tüm sayfalar
    // sırayla çekilip birleştirilir.
    for (;;) {
      const params = new URLSearchParams({ page: String(page), pageSize: "100" });
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const body = await res.json();
      const items: Row[] = body.items ?? [];
      allRows.push(...items);
      if (items.length < 100 || allRows.length >= (body.total ?? 0)) break;
      page += 1;
    }

    const csv = toCsv(
      ["Başlık", "Durum", "Öncelik", "Oluşturan", "Güncellenme Tarihi"],
      allRows.map((r) => [r.title, contentStatusLabel(r.status), r.priority, r.createdBy.name || r.createdBy.email, r.updatedAt.slice(0, 10)]),
    );
    downloadCsv(csv, `${kind}-icerikleri-${todayIso()}.csv`);
    setExportingKind(null);
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Başlangıç</Label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Bitiş</Label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        {(from || to) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Filtreyi Temizle
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sosyal Medya" value={data.counts.social} />
        <StatCard label="Blog & SEO" value={data.counts.blog} />
        <StatCard label="SEO Çalışmaları" value={data.counts.seo} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yayınlanan İçerik Performansı ({data.performance.publishedCount} kayıt)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Erişim" value={data.performance.totals.reach} />
          <StatCard label="Gösterim" value={data.performance.totals.impressions} />
          <StatCard label="Beğeni" value={data.performance.totals.likes} />
          <StatCard label="Yorum" value={data.performance.totals.comments} />
          <StatCard label="Paylaşım" value={data.performance.totals.shares} />
          <StatCard label="Kaydetme" value={data.performance.totals.saves} />
          <StatCard label="Bağlantı Tıklaması" value={data.performance.totals.linkClicks} />
          <StatCard label="Ort. Etkileşim Oranı" value={`%${data.performance.avgEngagementRate}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Dağılımı</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.platformBreakdown.map((p) => ({ name: socialPlatformLabel(p.platform), count: p.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kişi Bazlı Üretkenlik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.byPerson.slice(0, 10).map((p) => (
              <div key={p.userId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground">{p.contentCount} içerik</span>
              </div>
            ))}
            {data.byPerson.length === 0 && <p className="text-sm text-muted-foreground">Kayıt yok.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dışa Aktarma</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXPORT_KINDS.map((k) => (
            <Button key={k.kind} variant="secondary" size="sm" disabled={exportingKind === k.kind} onClick={() => exportKind(k.kind, k.label, k.endpoint)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exportingKind === k.kind ? "Aktarılıyor..." : `${k.label} (CSV)`}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
