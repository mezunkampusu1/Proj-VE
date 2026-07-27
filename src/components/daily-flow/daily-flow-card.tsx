"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Play, Coffee, RotateCcw, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, formatDurationHM, formatDurationMinutes, dailyFlowStatusLabel } from "@/lib/utils";
import { emitDailyFlowChanged } from "@/lib/daily-flow-events";

type FlowStatus = "NOT_STARTED" | "ACTIVE" | "ON_BREAK" | "COMPLETED";

interface FlowBreak {
  id: string;
  startedAt: string;
  endedAt: string | null;
}

interface FlowEntry {
  id: string;
  startedAt: string;
  completedAt: string | null;
  note: string | null;
  totalActiveSeconds: number | null;
  totalBreakSeconds: number | null;
  breakCount: number | null;
  breaks: FlowBreak[];
}

interface TimelineEvent {
  kind: "STARTED" | "BREAK_STARTED" | "BREAK_ENDED" | "COMPLETED";
  at: string;
}

interface FlowResponse {
  status: FlowStatus;
  entry: FlowEntry | null;
  breakAllowance: { summaryText: string };
  scheduleTags: { kind: string; label: string }[];
  timeline: TimelineEvent[];
  /** Sunucunun bu yanıtı ürettiği an — client/server saat farkı düzeltmesi için (bkz. görev #166). */
  serverNow?: string;
}

const timelineLabels: Record<TimelineEvent["kind"], string> = {
  STARTED: "Akış başlatıldı",
  BREAK_STARTED: "Ara verildi",
  BREAK_ENDED: "Akışa dönüldü",
  COMPLETED: "Gün tamamlandı",
};

const statusTone: Record<FlowStatus, "slate" | "blue" | "amber" | "green"> = {
  NOT_STARTED: "slate",
  ACTIVE: "blue",
  ON_BREAK: "amber",
  COMPLETED: "green",
};

/** Sunucudan gelen son veriyle, açık ara/aktif süreyi istemcide saniyede bir günceller — sunucu yeniden çağrılmaz. */
function computeLiveActiveSeconds(entry: FlowEntry, status: FlowStatus, now: number): number {
  if (status === "COMPLETED") return entry.totalActiveSeconds ?? 0;
  const start = new Date(entry.startedAt).getTime();
  let breakMs = 0;
  for (const b of entry.breaks) {
    const bStart = new Date(b.startedAt).getTime();
    const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : now;
    breakMs += Math.max(0, bEnd - bStart);
  }
  return Math.max(0, Math.floor((now - start - breakMs) / 1000));
}

export function DailyFlowCard() {
  const [data, setData] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [completeOpen, setCompleteOpen] = useState(false);
  const [note, setNote] = useState("");
  // Sunucu saati - istemci saati farkı. Cihaz saati sunucudan ileri/geri
  // olabilir (bkz. görev #166 — bu yüzden "Aktif süre" saymaya
  // başlamıyordu); canlı sayaç ham Date.now() yerine bu ofsetle düzeltilmiş
  // zamanı kullanır. Ref'te tutulur çünkü değişimi yeniden render tetiklemesi
  // gerekmiyor — zaten her saniye `now` state'i render'ı tetikliyor.
  const clockOffsetRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/daily-flow");
    if (!res.ok) return;
    const receivedAt = Date.now();
    const json = await res.json();
    if (json.serverNow) {
      clockOffsetRef.current = new Date(json.serverNow).getTime() - receivedAt;
    }
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Kullanıcı talebi: "ara verdiğinde/akışa döndüğünde anlık olması
    // lazım, biraz geç geliyor" — bir yönetici bu kullanıcının durumunu
    // panelden değiştirirse (bkz. admin-dashboard.tsx) kendi kartı da bunu
    // en geç bu döngüde görmeli; 30sn yerine diğer modüllerle tutarlı 5sn'e
    // düşürüldü, sekme tekrar görünür/odakta olduğunda da beklemeden
    // yenilenir (bkz. team-status-list.tsx'teki aynı desen).
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

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function callAction(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Bir şeyler ters gitti.");
        return false;
      }
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    const result = await callAction("/api/daily-flow", "POST");
    if (result) {
      toast.success("Günlük akışın başladı. Güzel bir gün olsun.");
      await load();
      emitDailyFlowChanged();
    }
  }

  async function handleBreak() {
    const result = await callAction("/api/daily-flow/break", "POST");
    if (result) {
      toast.success("Ara kaydın oluşturuldu.");
      await load();
      emitDailyFlowChanged();
    }
  }

  async function handleResume() {
    const result = await callAction("/api/daily-flow/resume", "POST");
    if (result) {
      toast.success("Tekrar hoş geldin. Akışın devam ediyor.");
      await load();
      emitDailyFlowChanged();
    }
  }

  async function handleComplete() {
    const result = await callAction("/api/daily-flow/complete", "POST", { note: note || undefined });
    if (result) {
      toast.success("Bugünün akışını tamamladın. Eline sağlık.");
      setCompleteOpen(false);
      setNote("");
      await load();
      emitDailyFlowChanged();
    }
  }

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const { status, entry, breakAllowance, scheduleTags, timeline } = data;
  // Ham `now` yerine sunucu ofsetiyle düzeltilmiş tahmini sunucu zamanı
  // kullanılır (bkz. görev #166 ve yukarıdaki clockOffsetRef notu).
  const estimatedServerNow = now + clockOffsetRef.current;
  const liveActiveSeconds = entry ? computeLiveActiveSeconds(entry, status, estimatedServerNow) : 0;
  const openBreak = entry?.breaks.find((b) => !b.endedAt);
  const liveBreakSeconds = openBreak
    ? Math.floor((estimatedServerNow - new Date(openBreak.startedAt).getTime()) / 1000)
    : 0;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-1 bg-[image:var(--gradient-primary)]" />
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Günlük Akış</CardTitle>
          <Badge tone={statusTone[status]}>{dailyFlowStatusLabel(status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {status === "NOT_STARTED" && (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">
                Bugüne henüz başlamadın. Hazır olduğunda akışını başlat.
              </p>
              <Button onClick={handleStart} disabled={busy} className="gap-2">
                <Play className="h-4 w-4" /> Akışı Başlat
              </Button>
            </div>
          )}

          {(status === "ACTIVE" || status === "ON_BREAK") && entry && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Aktif süre</p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {formatDurationHM(liveActiveSeconds)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Başlangıç</p>
                  <p className="text-sm font-medium text-foreground">{formatTime(entry.startedAt)}</p>
                </div>
                {status === "ON_BREAK" && (
                  <div>
                    <p className="text-xs text-muted-foreground">Bu aranın süresi</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDurationMinutes(liveBreakSeconds)}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{breakAllowance.summaryText}</p>

              {scheduleTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scheduleTags.map((tag) => (
                    <Badge key={tag.kind} tone="slate">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {status === "ACTIVE" && (
                  <>
                    <Button variant="secondary" onClick={handleBreak} disabled={busy} className="gap-2">
                      <Coffee className="h-4 w-4" /> Ara Ver
                    </Button>
                    <Button onClick={() => setCompleteOpen(true)} disabled={busy} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Günü Tamamla
                    </Button>
                  </>
                )}
                {status === "ON_BREAK" && (
                  <Button onClick={handleResume} disabled={busy} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Akışa Dön
                  </Button>
                )}
              </div>
            </div>
          )}

          {status === "COMPLETED" && entry && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Toplam aktif süre</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatDurationHM(entry.totalActiveSeconds ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Başlangıç — Bitiş</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatTime(entry.startedAt)} — {formatTime(entry.completedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ara</p>
                  <p className="text-sm font-medium text-foreground">
                    {entry.breakCount ?? 0} kez, {formatDurationMinutes(entry.totalBreakSeconds ?? 0)}
                  </p>
                </div>
              </div>
              {entry.note && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground/90">{entry.note}</p>
              )}
              <p className="text-sm text-muted-foreground">Bugünün akışını tamamladın. Eline sağlık.</p>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Bugünün zaman çizelgesi</p>
              <ul className="space-y-1">
                {timeline.map((event, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{formatTime(event.at)}</span>
                    <span>—</span>
                    <span>{timelineLabels[event.kind]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Günü Tamamla">
        {entry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Başlangıç saati</p>
                <p className="font-medium text-foreground">{formatTime(entry.startedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam aktif süre</p>
                <p className="font-medium text-foreground">{formatDurationHM(liveActiveSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam ara süresi</p>
                <p className="font-medium text-foreground">
                  {formatDurationMinutes(entry.breaks.reduce((sum, b) => {
                    const end = b.endedAt ? new Date(b.endedAt).getTime() : estimatedServerNow;
                    return sum + Math.max(0, end - new Date(b.startedAt).getTime()) / 1000;
                  }, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ara sayısı</p>
                <p className="font-medium text-foreground">{entry.breaks.filter((b) => b.endedAt).length}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Günlük not (isteğe bağlı)
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bugün üzerinde çalıştığın konular veya yarına bırakılan kısa bir not..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCompleteOpen(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button onClick={handleComplete} disabled={busy}>
                Günü Tamamla
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
