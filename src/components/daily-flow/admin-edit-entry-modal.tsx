"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditEntryTarget {
  /** null ise bu kullanıcı için o gün hiç kayıt yok — kaydet, yeni oluşturur (bkz. görev #168). */
  entryId: string | null;
  userId: string;
  userName: string;
  /** Düzenlenen/oluşturulan günün "YYYY-AA-GG" hâli (bkz. görev #167). */
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

/** Datetime-local input değerini (yerel saat, saniyesiz) ISO string'e çevirir. */
function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

/** ISO string'i `<input type="datetime-local">` için beklenen biçime çevirir. */
function isoToLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminEditEntryModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditEntryTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startedAt, setStartedAt] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // Kayıt yoksa (entryId null) aynı kullanıcı+gün kombinasyonu için ayrı bir
  // anahtar kullanılır — birden çok "Kaydı Oluştur" hedefi entryId'siz
  // olduğundan tek başına entryId artık benzersiz bir anahtar değil.
  const targetKey = target ? `${target.userId}:${target.date}:${target.entryId ?? "new"}` : null;

  if (target && initializedFor !== targetKey) {
    setStartedAt(target.startedAt ? isoToLocalInput(target.startedAt) : `${target.date}T09:00`);
    setCompletedAt(isoToLocalInput(target.completedAt));
    setNote(target.note ?? "");
    setReason("");
    setInitializedFor(targetKey);
  }

  async function handleSave() {
    if (!target) return;
    if (!reason.trim()) {
      toast.error(target.entryId ? "Düzeltme için kısa bir not girin." : "Kayıt oluşturma için kısa bir not girin.");
      return;
    }
    if (!startedAt) {
      toast.error("Başlangıç saati girin.");
      return;
    }
    setBusy(true);
    try {
      const url = target.entryId
        ? `/api/daily-flow/admin/entries/${target.entryId}`
        : "/api/daily-flow/admin/entries/manual";
      const body = target.entryId
        ? {
            startedAt: localInputToIso(startedAt),
            completedAt: completedAt ? localInputToIso(completedAt) : null,
            note: note || null,
            reason,
          }
        : {
            userId: target.userId,
            date: target.date,
            startedAt: localInputToIso(startedAt),
            completedAt: completedAt ? localInputToIso(completedAt) : null,
            note: note || null,
            reason,
          };
      const res = await fetch(url, {
        method: target.entryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Kayıt kaydedilemedi.");
        return;
      }
      toast.success(target.entryId ? "Kayıt güncellendi." : "Kayıt oluşturuldu.");
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target ? `${target.userName} — ${target.entryId ? "Kaydı Düzenle" : "Kaydı Oluştur"}` : ""}
    >
      {target && (
        <div className="space-y-4">
          {!target.entryId && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Bu kullanıcı için {target.date} tarihinde henüz kayıt yok. Aşağıdaki bilgilerle yeni bir kayıt
              oluşturacaksınız.
            </p>
          )}
          <div>
            <Label>Başlangıç saati</Label>
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
          <div>
            <Label>Bitiş saati (boş bırakılırsa gün açık kalır)</Label>
            <Input type="datetime-local" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
          </div>
          <div>
            <Label>Günlük not</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>{target.entryId ? "Düzeltme notu (zorunlu)" : "Oluşturma notu (zorunlu)"}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Örn: Kullanıcı bildirdi, saat hatalı girilmişti."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              Kaydet
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export type { EditEntryTarget };
