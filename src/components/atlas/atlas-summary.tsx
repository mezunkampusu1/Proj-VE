"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
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
import { formatDate } from "@/lib/utils";

interface RecentChange {
  id: string;
  programName: string;
  actorName: string;
  message: string;
  changedAt: string;
  changedAtLabel: string | null;
}

interface SummaryData {
  todayCount: number;
  weekCount: number;
  activeCount: number;
  inactiveCount: number;
  byDate: { date: string; count: number }[];
  byInstitute: { instituteId: string; name: string; count: number }[];
  byUser: { userId: string; name: string; count: number }[];
  byDegree: { degreeLevel: string; name: string; count: number }[];
  recentChanges: RecentChange[];
}

const CHART_COLORS = [
  "var(--primary)",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#fb923c",
  "#4ade80",
  "#f87171",
  "#38bdf8",
];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function truncateLabel(label: string, max = 14) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/**
 * Atlas için özet/rapor paneli — Duyurular'ın özet panelle aynı desen.
 * Ek olarak "sürekli güncelleniyor" geri bildirimi üzerine bir "Son
 * Değişiklikler" mini akışı içerir (AtlasChangeLog'dan son 10 kayıt).
 */
export function AtlasSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/atlas/programs/summary")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error ?? "Özet yüklenemedi.");
        }
        setData(body);
      })
      .catch((err) => setError(err.message ?? "Özet yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Özet yükleniyor...</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data) return null;

  const chartData = data.byDate.map((d) => ({ date: formatDate(d.date), count: d.count }));
  const instituteChartData = data.byInstitute.map((i) => ({
    name: truncateLabel(i.name),
    fullName: i.name,
    count: i.count,
  }));
  const userChartData = data.byUser.map((u) => ({
    name: truncateLabel(u.name),
    fullName: u.name,
    count: u.count,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bugün Girilen" value={data.todayCount} />
        <StatCard label="Bu Hafta Girilen" value={data.weekCount} />
        <StatCard label="Aktif Program" value={data.activeCount} />
        <StatCard label="Pasif Program" value={data.inactiveCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son 30 Gün Giriş Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Program"]} />
                <Bar dataKey="count" name="Program" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enstitüye Göre Dağılım (ilk 10, aktif)</CardTitle>
          </CardHeader>
          <CardContent>
            {instituteChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={instituteChartData} margin={{ top: 5, right: 10, left: -20, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [value, "Program"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="count" name="Program" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dereceye Göre Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byDegree.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byDegree}
                      dataKey="count"
                      nameKey="name"
                      innerRadius="45%"
                      outerRadius="75%"
                      paddingAngle={2}
                    >
                      {data.byDegree.map((entry, index) => (
                        <Cell key={entry.degreeLevel} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Program"]} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kişiye Göre Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            {userChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChartData} margin={{ top: 5, right: 10, left: -20, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [value, "Program"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="count" name="Program" fill="#34d399" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son Değişiklikler</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz değişiklik yok.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {data.recentChanges.map((c) => (
                  <div key={c.id} className="rounded-md bg-secondary/40 px-3 py-2 text-sm">
                    <p className="text-foreground/90">{c.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.actorName} · {c.changedAtLabel}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
