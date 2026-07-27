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
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface SummaryData {
  totalCount: number;
  todayCount: number;
  weekCount: number;
  byDate: { date: string; count: number }[];
  byUniversity: { universityId: string; name: string; count: number }[];
  byUser: { userId: string; name: string; count: number }[];
  byType: { typeId: string; kind: "ANNOUNCEMENT" | "DATE"; name: string; count: number }[];
}

// Duyurular özet panelindeki paletle AYNI (bkz. announcements-summary.tsx) —
// projede tutarlı bir görsel dil için renkler tekrar kullanılıyor.
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
 * Veri Girişi için birleşik özet/rapor paneli (bkz. kullanıcı talebi: "kaç
 * tane girildi, hangi üniversiteden ne kadar girildi, en çok hangi tür
 * girildi — böyle raporlama istiyorum"). Duyurular ve Tarihler tablolarını
 * tek bir "veri girişi" bakış açısıyla birleştirir; her iki modülün kendi
 * özet panelleri (AnnouncementsSummary/DatesSummary) hâlâ yerinde durur, bu
 * yalnızca ikisini bir arada gösteren ek bir görünümdür.
 */
export function VeriGirisiSummary() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/veri-girisi/summary?days=30")
      .then((res) => res.json())
      .then((body) => setData(body))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Kullanıcı talebi: rapor da diğer modüller gibi F5 atmadan güncellensin.
  useLiveRefresh(load, 15000);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Rapor yükleniyor...</p>;
  }
  if (!data) return null;

  const chartData = data.byDate.map((d) => ({ date: formatDate(d.date), count: d.count }));
  const universityChartData = data.byUniversity.map((u) => ({
    name: truncateLabel(u.name),
    fullName: u.name,
    count: u.count,
  }));
  const typeChartData = data.byType.slice(0, 10).map((t) => ({
    ...t,
    label: truncateLabel(`${t.name} (${t.kind === "ANNOUNCEMENT" ? "Veri" : "Tarih"})`, 20),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Toplam Kayıt" value={data.totalCount} />
        <StatCard label="Bugün Girilen" value={data.todayCount} />
        <StatCard label="Bu Hafta Girilen" value={data.weekCount} />
        <StatCard label="Son 30 Günde Toplam" value={data.byDate.reduce((s, d) => s + d.count, 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son 30 Gün Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Kayıt" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Üniversiteye Göre Dağılım (ilk 10, son 30 gün)</CardTitle>
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
                      formatter={(value) => [value, "Kayıt"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="count" name="Kayıt" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Türe Göre Dağılım (ilk 10, son 30 gün)</CardTitle>
          </CardHeader>
          <CardContent>
            {typeChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      dataKey="count"
                      nameKey="label"
                      innerRadius="45%"
                      outerRadius="75%"
                      paddingAngle={2}
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={entry.typeId} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Kayıt"]} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
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
          <CardTitle>Kişiye Göre Dağılım (son 30 gün)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byUser.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.byUser.map((u) => ({ name: truncateLabel(u.name), fullName: u.name, count: u.count }))}
                  margin={{ top: 5, right: 10, left: -20, bottom: 32 }}
                >
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
                    formatter={(value) => [value, "Kayıt"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Bar dataKey="count" name="Kayıt" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
