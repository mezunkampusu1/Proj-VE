"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, MoreHorizontal, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTime, formatDurationHM, formatDurationMinutes, dailyFlowStatusLabel } from "@/lib/utils";
import { emitDailyFlowChanged } from "@/lib/daily-flow-events";
import { AdminEditEntryModal, type EditEntryTarget } from "@/components/daily-flow/admin-edit-entry-modal";
import { AdminSettingsModal, type SettingsTarget } from "@/components/daily-flow/admin-settings-modal";
import { DayNavigator } from "@/components/announcements/day-navigator";

/** "YYYY-AA-GG" biçiminde, yerel takvim gününe göre bugünün tarihi. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FlowStatus = "NOT_STARTED" | "ACTIVE" | "ON_BREAK" | "COMPLETED";

interface TeamRow {
  user: { id: string; name: string | null; email: string; image: string | null };
  entryId: string | null;
  status: FlowStatus;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  activeSeconds: number;
  breakSeconds: number;
  lastAction: string | null;
  warning: string | null;
}

interface SummaryResponse {
  summary: {
    startedCount: number;
    activeCount: number;
    onBreakCount: number;
    completedCount: number;
    notStartedCount: number;
    missingCount: number;
  };
  team: TeamRow[];
  openPastEntries: { id: string; userId: string; userName: string; date: string; status: string }[];
}

const statusTone: Record<FlowStatus, "slate" | "blue" | "amber" | "green"> = {
  NOT_STARTED: "slate",
  ACTIVE: "blue",
  ON_BREAK: "amber",
  COMPLETED: "green",
};

const SUMMARY_CARDS: { key: keyof SummaryResponse["summary"]; label: string }[] = [
  { key: "startedCount", label: "Akışını Başlatan" },
  { key: "activeCount", label: "Şu An Aktif" },
  { key: "onBreakCount", label: "Şu An Arada" },
  { key: "completedCount", label: "Gününü Tamamlayan" },
  { key: "notStartedCount", label: "Henüz Başlamayan" },
  { key: "missingCount", label: "Eksik Kayıt" },
];

export function AdminDashboard() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditEntryTarget | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<SettingsTarget | null>(null);
  // Görüntülenen/düzenlenen gün — varsayılan her zaman bugün, yönetici
  // takvimden başka bir güne geçebilir (bkz. görev #167).
  const [date, setDate] = useState(() => todayIso());
  const isToday = date === todayIso();

  const load = useCallback(async () => {
    const res = await fetch(`/api/daily-flow/admin/summary?date=${date}`);
    if (!res.ok) return;
    setData(await res.json());
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Kullanıcı talebi: diğer Günlük Akış görünümleriyle (bkz.
    // team-status-list.tsx, daily-flow-card.tsx) tutarlı 5sn + sekme
    // odağa döndüğünde anında yenileme.
    const interval = setInterval(load, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function runAction(entryId: string, url: string, method: string) {
    setBusyEntryId(entryId);
    try {
      const res = await fetch(url, { method });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "İşlem gerçekleştirilemedi.");
        return;
      }
      await load();
      emitDailyFlowChanged();
    } finally {
      setBusyEntryId(null);
    }
  }

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {SUMMARY_CARDS.map((c) => (
          <div key={c.key} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DayNavigator value={date} onChange={setDate} />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {SUMMARY_CARDS.map((c) => (
          <Card key={c.key}>
            <CardContent className="pt-5">
              <p className="text-2xl font-semibold text-foreground">{data.summary[c.key]}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.openPastEntries.length > 0 && (
        <Card className="border-tint-amber-fg/30">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tint-amber-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Açık kalan geçmiş kayıtlar</p>
              {data.openPastEntries.map((e) => (
                <p key={e.id} className="text-xs text-muted-foreground">
                  {e.userName} — {new Date(e.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} ({dailyFlowStatusLabel(e.status)})
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setSettingsTarget({ kind: "teamDefault" })}>
          Varsayılan Ara Hakkı
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a href="/api/daily-flow/admin/export" className="gap-2">
            <Download className="h-4 w-4" /> Excel&apos;e Aktar
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          {/* Revizyon: "yazılar yan yana geliyor" — hücrelerde yalnızca
              dikey boşluk vardı, yatay boşluk (px) eksikti; bitişik
              sütunlar arasında boşluk bırakmak ve dikeyde ortalamak için
              her <th>/<td>'ye px-3 + align-middle eklendi (bkz.
              activity-log-view.tsx'teki aynı düzeltme). */}
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 pl-0 font-medium">Kullanıcı</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Başlangıç</th>
                <th className="px-3 py-2 font-medium">Aktif Süre</th>
                <th className="px-3 py-2 font-medium">Ara</th>
                <th className="px-3 py-2 font-medium">Son İşlem</th>
                <th className="px-3 py-2 pr-0 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.team.map((row) => (
                <tr key={row.user.id}>
                  <td className="px-3 py-2.5 pl-0 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={row.user.name} email={row.user.email} size={28} />
                      <span className="truncate font-medium text-foreground">{row.user.name || row.user.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex flex-col gap-1">
                      <Badge tone={statusTone[row.status]}>{dailyFlowStatusLabel(row.status)}</Badge>
                      {row.warning && (
                        <span className="text-xs text-tint-amber-foreground">{row.warning}</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                    {row.startedAt ? formatTime(row.startedAt) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle tabular-nums text-muted-foreground">
                    {row.status === "NOT_STARTED" ? "—" : formatDurationHM(row.activeSeconds)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                    {row.status === "NOT_STARTED" ? "—" : formatDurationMinutes(row.breakSeconds)}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground">{row.lastAction || "—"}</td>
                  <td className="px-3 py-2.5 pr-0 align-middle text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="rounded-lg p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                        // Asıl hata buradaydı (bkz. görev #168): `row.entryId`
                        // null olduğunda (henüz akış başlatmamış kullanıcı) ve
                        // hiçbir işlem sürmüyorken `busyEntryId` de null olduğu
                        // için `null === null` her zaman true dönüyor, bu da
                        // menüyü kalıcı olarak devre dışı bırakıyordu — yani
                        // admin, kendi dışındaki (henüz başlamamış) hemen her
                        // kullanıcı için "..." menüsünü hiç açamıyordu.
                        disabled={row.entryId != null && busyEntryId === row.entryId}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {/* Kayıt yoksa da bu öge her zaman görünür — yönetici
                            herhangi bir kullanıcı için (kendisi dahil) o günün
                            kaydını oluşturabilmeli (bkz. görev #168). */}
                        <DropdownMenuItem
                          onClick={() =>
                            setEditTarget({
                              entryId: row.entryId,
                              userId: row.user.id,
                              userName: row.user.name || row.user.email,
                              date,
                              startedAt: row.startedAt,
                              completedAt: row.completedAt,
                              note: row.note,
                            })
                          }
                        >
                          {row.entryId ? "Kaydı Düzenle" : "Kaydı Oluştur"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setSettingsTarget({
                              kind: "user",
                              userId: row.user.id,
                              userName: row.user.name || row.user.email,
                            })
                          }
                        >
                          Ara Hakkı Tanımla
                        </DropdownMenuItem>
                        {/* Canlı işlemler (ara/tamamlama/yeniden açma) yalnızca
                            bugün için anlamlı — geçmiş bir gün görüntülenirken
                            yukarıdaki "Kaydı Düzenle" ile elle düzeltme yapılır. */}
                        {isToday && row.entryId && row.status === "ACTIVE" && (
                          <DropdownMenuItem
                            onClick={() => runAction(row.entryId!, `/api/daily-flow/admin/entries/${row.entryId}/break`, "POST")}
                          >
                            Kullanıcı Adına Ara Başlat
                          </DropdownMenuItem>
                        )}
                        {isToday && row.entryId && row.status === "ON_BREAK" && (
                          <DropdownMenuItem
                            onClick={() => runAction(row.entryId!, `/api/daily-flow/admin/entries/${row.entryId}/break`, "PATCH")}
                          >
                            Kullanıcı Adına Arayı Bitir
                          </DropdownMenuItem>
                        )}
                        {isToday && row.entryId && (row.status === "ACTIVE" || row.status === "ON_BREAK") && (
                          <DropdownMenuItem
                            onClick={() => runAction(row.entryId!, `/api/daily-flow/admin/entries/${row.entryId}/complete`, "POST")}
                          >
                            Kullanıcı Adına Günü Tamamla
                          </DropdownMenuItem>
                        )}
                        {isToday && row.entryId && row.status === "COMPLETED" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => runAction(row.entryId!, `/api/daily-flow/admin/entries/${row.entryId}/reopen`, "POST")}
                            >
                              Günü Yeniden Aç
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AdminEditEntryModal target={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
      <AdminSettingsModal target={settingsTarget} onClose={() => setSettingsTarget(null)} />
    </div>
  );
}
