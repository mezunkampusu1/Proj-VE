"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share2, Newspaper, Search, AtSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { contentStatusLabel, contentStatusTone, formatDate } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface UpcomingItem {
  id: string;
  kind: "social" | "blog" | "seo";
  title: string;
  date: string | null;
}

interface SummaryResponse {
  counts: { social: number; blog: number; seo: number };
  mentionedCount: number;
  statusBreakdown: { status: string; count: number }[];
  upcoming: UpcomingItem[];
}

const KIND_LABELS: Record<UpcomingItem["kind"], string> = {
  social: "Sosyal Medya",
  blog: "Blog",
  seo: "SEO",
};

const KIND_HREF: Record<UpcomingItem["kind"], string> = {
  social: "/content/social",
  blog: "/content/blog",
  seo: "/content/seo",
};

/**
 * Sosyal Medya & İçerik özet bölümü — eskiden ayrı bir "Genel Bakış"
 * sayfasıydı (`/content`), ana Panel'e (bkz. `dashboard/page.tsx`) taşındı.
 * Onay Bekleyenler & Atamalar sayfası ve Günlük Çalışma Raporları modülü
 * kaldırıldığı için o verilere dayanan kartlar (Onay Bekleyen, Bana Atanan,
 * Bugünkü Rapor) da kaldırıldı — bkz. `/api/content/summary` güncellemesi.
 * Revizyon #325: Site İçi Çalışmalar modülü komple kaldırıldığı için o
 * karta ve `websiteWork` sayımına da artık gerek yok.
 */
export function ContentDashboardSection() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/content/summary")
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  // Kullanıcı talebi: özet F5 atmadan gelsin.
  useLiveRefresh(load, 15000);

  if (loading || !summary) {
    return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleCountCard icon={Share2} tone="blue" label="Sosyal Medya" value={summary.counts.social} href="/content/social" />
        <ModuleCountCard icon={Newspaper} tone="green" label="Blog & SEO" value={summary.counts.blog} href="/content/blog" />
        <ModuleCountCard icon={Search} tone="amber" label="SEO Çalışmaları" value={summary.counts.seo} href="/content/seo" />
        <ModuleCountCard icon={AtSign} tone="green" label="Etiketlendiğim" value={summary.mentionedCount} href="/content/social" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sosyal Medya Durum Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.statusBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz içerik yok.</p>
            )}
            {summary.statusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center justify-between gap-3">
                <Badge tone={contentStatusTone[s.status] ?? "slate"}>{contentStatusLabel(s.status)}</Badge>
                <span className="text-sm font-medium text-foreground">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yaklaşan Yayın / Son Tarihler (7 gün)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {summary.upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Yaklaşan bir şey yok.</p>
            )}
            {summary.upcoming.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={KIND_HREF[item.kind]}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{KIND_LABELS[item.kind]}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModuleCountCard({
  icon: Icon,
  tone,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "green" | "amber" | "slate";
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3 pt-5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-${tone} text-tint-${tone}-foreground`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
