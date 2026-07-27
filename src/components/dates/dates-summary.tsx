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
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryData {
  upcoming7Count: number;
  upcoming30Count: number;
  overdueCount: number;
  pendingEndDateCount: number;
  byMonth: { month: string; count: number }[];
  byUniversity: { universityId: string; name: string; count: number }[];
  byUser: { userId: string; name: string; count: number }[];
  byType: { typeId: string; name: string; count: number }[];
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

function formatMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM yyyy", { locale: tr });
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/**
 * Tarihler için özet/rapor paneli — Duyurular'daki özet panelle aynı
 * desen. Fark: burada "bugün ne girildi" değil "önümüzde ne var, süresi
 * geçen ne var" sorusu önemli olduğu için istatistikler yaklaşan/süresi
 * geçen deadline'lara odaklanır.
 */
export function DatesSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dates/summary")
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

  const monthChartData = data.byMonth.map((m) => ({ month: formatMonth(m.month), count: m.count }));
  const universityChartData = data.byUniversity.map((u) => ({
    name: truncateLabel(u.name),
    fullName: u.name,
    count: u.count,
  }));
  const userChartData = data.byUser.map((u) => ({
    name: truncateLabel(u.name),
    fullName: u.name,
    count: u.count,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bu Hafta Yaklaşan" value={data.upcoming7Count} />
        <StatCard label="Bu Ay Yaklaşan" value={data.upcoming30Count} />
        <StatCard label="Süresi Geçen" value={data.overdueCount} />
        <StatCard label="Bitiş Tarihi Bekleyen" value={data.pendingEndDateCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Önümüzdeki 6 Ay — Yaklaşan Tarih Sayısı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Tarih"]} />
                <Bar dataKey="count" name="Tarih" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Üniversiteye Göre Dağılım (ilk 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {universityChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={universityChartData} margin={{ top: 5, right: 10, left: -20, bottom: 32 }}>
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
                      formatter={(value) => [value, "Tarih"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="count" name="Tarih" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Türe Göre Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byType}
                      dataKey="count"
                      nameKey="name"
                      innerRadius="45%"
                      outerRadius="75%"
                      paddingAngle={2}
                    >
                      {data.byType.map((entry, index) => (
                        <Cell key={entry.typeId} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Tarih"]} />
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
                    formatter={(value) => [value, "Tarih"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Bar dataKey="count" name="Tarih" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
