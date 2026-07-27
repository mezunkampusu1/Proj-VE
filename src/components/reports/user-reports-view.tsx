"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Stat {
  id: string;
  date: string;
  newUserCount: number;
  emailVerifiedCount: number;
  phoneVerifiedCount: number;
  /** Günlük veri girişinin yanına bırakılan kısa not (bkz. proje talebi). */
  note: string | null;
  recordedById: string;
  recordedBy: { id: string; name: string | null; email: string };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function UserReportsView({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [newUserCount, setNewUserCount] = useState("0");
  const [emailVerifiedCount, setEmailVerifiedCount] = useState("0");
  const [phoneVerifiedCount, setPhoneVerifiedCount] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Stat | null>(null);

  function load() {
    fetch("/api/user-reports?days=30")
      .then((res) => res.json())
      .then((data) => setStats(data.stats ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Revizyon: "güncelleme yapıldığında anlık yansımıyor... admindede f5
    // gerekiyor" — bu sayfa iki farklı sekmede/kullanıcıda açık olabilir
    // (örn. admin izliyorken çalışan kendi kaydını giriyor); kendi
    // aksiyonunuz zaten submit/remove sonrası anında `load()` çağırıyor,
    // ama BAŞKA bir oturumdaki değişikliği görmek için düzenli bir
    // yoklama (polling) gerekiyor — tıpkı Günlük Akış'taki TeamStatusList
    // ve AdminDashboard'daki desen gibi (bkz. o dosyalardaki 20-30sn
    // aralıklı setInterval).
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  function editRow(stat: Stat) {
    setDate(stat.date.slice(0, 10));
    setNewUserCount(String(stat.newUserCount));
    setEmailVerifiedCount(String(stat.emailVerifiedCount));
    setPhoneVerifiedCount(String(stat.phoneVerifiedCount));
    setNote(stat.note ?? "");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/user-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        newUserCount: Number(newUserCount) || 0,
        emailVerifiedCount: Number(emailVerifiedCount) || 0,
        phoneVerifiedCount: Number(phoneVerifiedCount) || 0,
        note: note.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setNote("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Kaydedilemedi.");
    }
  }

  async function remove(id: string) {
    setStats((s) => s.filter((row) => row.id !== id));
    await fetch(`/api/user-reports/${id}`, { method: "DELETE" });
    setPendingDelete(null);
  }

  const chartData = [...stats]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: formatDate(s.date),
      "Yeni Kullanıcı": s.newUserCount,
      "E-posta Doğrulama": s.emailVerifiedCount,
      "Telefon Doğrulama": s.phoneVerifiedCount,
    }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Günlük Veri Girişi</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {/* Revizyon: "sayfa ile oynandığında böyle kaymalar var" — sütunlar
              düz `1fr` idi; CSS Grid'de `1fr` tek başına yine de içeriğin
              min-content genişliğini referans alır, bu yüzden bir alanın
              içeriği (örn. seçilen ayın adı uzayıp kısalınca) diğer tüm
              sütunları yatayda kaydırabiliyordu. `minmax(0,1fr)` + her
              hücreye `min-w-0` bu davranışı tamamen keser. */}
          <form
            onSubmit={submit}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Tarih</Label>
              <DatePicker value={date} onChange={setDate} maxDate={todayIso()} />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Yeni Kullanıcı</Label>
              <Input
                type="number"
                min={0}
                value={newUserCount}
                onChange={(e) => setNewUserCount(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">E-posta Doğrulama</Label>
              <Input
                type="number"
                min={0}
                value={emailVerifiedCount}
                onChange={(e) => setEmailVerifiedCount(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-muted-foreground">Telefon Doğrulama</Label>
              <Input
                type="number"
                min={0}
                value={phoneVerifiedCount}
                onChange={(e) => setPhoneVerifiedCount(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
            <div className="min-w-0 space-y-1 sm:col-span-5">
              <Label className="text-xs text-muted-foreground">Not (opsiyonel)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Bu güne dair kısa bir açıklama bırakabilirsin..."
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son 30 Gün Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz veri girilmemiş.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Yeni Kullanıcı" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="E-posta Doğrulama" stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Telefon Doğrulama" stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="text-foreground/90">{formatDate(s.date)}</p>
                    <p className="text-xs text-muted-foreground">
                      Yeni: {s.newUserCount} · E-posta: {s.emailVerifiedCount} · Telefon:{" "}
                      {s.phoneVerifiedCount} · {s.recordedBy.name || s.recordedBy.email}
                    </p>
                    {s.note && (
                      <p className="mt-0.5 truncate text-xs text-foreground/70" title={s.note}>
                        {s.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(isAdmin || s.recordedById === currentUserId) && (
                      <button
                        type="button"
                        onClick={() => editRow(s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(s)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                        aria-label="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        description={`${pendingDelete ? formatDate(pendingDelete.date) : ""} tarihli kaydı silmek istediğinize emin misiniz?`}
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
      />
    </div>
  );
}
