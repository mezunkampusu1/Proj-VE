"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * İki hedef türü var (bkz. görev #169 — "kişiye özgü tanımladığım gibi
 * genele de yapmam gerekiyor"): tek bir kullanıcının kişiye özel ayarı, ya
 * da kişiye özel ayarı olmayan herkes için geçerli olan takım varsayılanı.
 * İkisi de aynı form/aynı bileşenle düzenlenir — yalnızca hangi API
 * ucuna gittikleri değişir.
 */
type SettingsTarget =
  | { kind: "user"; userId: string; userName: string }
  | { kind: "teamDefault" };

interface SettingForm {
  maxBreakCount: string;
  maxBreakMinutes: string;
  maxTotalBreakMinutes: string;
  standardStart: string;
  standardEnd: string;
}

const EMPTY_FORM: SettingForm = {
  maxBreakCount: "",
  maxBreakMinutes: "",
  maxTotalBreakMinutes: "",
  standardStart: "",
  standardEnd: "",
};

function minutesToTimeInput(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function settingsUrl(target: SettingsTarget): string {
  return target.kind === "teamDefault"
    ? "/api/daily-flow/admin/settings/default"
    : `/api/daily-flow/admin/settings/${target.userId}`;
}

/**
 * Yöneticinin bir kullanıcı için (ya da takımın tamamı için varsayılan
 * olarak) ara hakkı + isteğe bağlı standart çalışma saatlerini tanımladığı
 * form. Her alan bağımsız boş bırakılabilir — boş alan "sınırsız" anlamına
 * gelir (bkz. proje kuralı §3). Kullanıcı hedefinde ayrıca, kaydedilen
 * ayarları tek tıkla takımın tamamına uygulayan bir toplu eylem sunar
 * (bkz. görev #169).
 */
export function AdminSettingsModal({
  target,
  onClose,
}: {
  target: SettingsTarget | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SettingForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  useEffect(() => {
    if (!target) {
      setLoaded(false);
      return;
    }
    setLoaded(false);
    fetch(settingsUrl(target))
      .then((res) => res.json())
      .then((data) => {
        const s = data.setting;
        setForm({
          maxBreakCount: s?.maxBreakCount != null ? String(s.maxBreakCount) : "",
          maxBreakMinutes: s?.maxBreakMinutes != null ? String(s.maxBreakMinutes) : "",
          maxTotalBreakMinutes: s?.maxTotalBreakMinutes != null ? String(s.maxTotalBreakMinutes) : "",
          standardStart: minutesToTimeInput(s?.standardStartMinute),
          standardEnd: minutesToTimeInput(s?.standardEndMinute),
        });
        setLoaded(true);
      });
  }, [target]);

  async function handleSave() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(settingsUrl(target), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxBreakCount: form.maxBreakCount ? Number(form.maxBreakCount) : null,
          maxBreakMinutes: form.maxBreakMinutes ? Number(form.maxBreakMinutes) : null,
          maxTotalBreakMinutes: form.maxTotalBreakMinutes ? Number(form.maxTotalBreakMinutes) : null,
          standardStartMinute: timeInputToMinutes(form.standardStart),
          standardEndMinute: timeInputToMinutes(form.standardEnd),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Ayar kaydedilemedi.");
        return;
      }
      toast.success(
        target.kind === "teamDefault" ? "Takım varsayılanı güncellendi." : "Ara hakkı ve çalışma düzeni güncellendi.",
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkApply() {
    if (!target || target.kind !== "user") return;
    setBusy(true);
    try {
      const res = await fetch("/api/daily-flow/admin/settings/bulk-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUserId: target.userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Toplu uygulama başarısız oldu.");
        return;
      }
      toast.success(`Ayarlar ${json.appliedCount} üyeye uygulandı.`);
      setBulkConfirmOpen(false);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const title =
    target?.kind === "teamDefault" ? "Takım Varsayılanı — Ara Hakkı" : target ? `${target.userName} — Ara Hakkı` : "";

  return (
    <>
      <Modal open={!!target} onClose={onClose} title={title}>
        {target && !loaded && <p className="text-sm text-muted-foreground">Yükleniyor...</p>}
        {target && loaded && (
          <div className="space-y-4">
            {target.kind === "teamDefault" && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Bu ayar, kişiye özel bir ara hakkı tanımlanmamış tüm üyeler için geçerli olur. Bir üye için
                ayrıca kişiye özel bir ayar tanımlanırsa, o üyede bu varsayılan yerine kendi ayarı kullanılır.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Günlük ara adedi</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sınırsız"
                  value={form.maxBreakCount}
                  onChange={(e) => setForm((f) => ({ ...f, maxBreakCount: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Her aranın azami süresi (dk)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sınırsız"
                  value={form.maxBreakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, maxBreakMinutes: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Toplam günlük ara süresi (dk)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sınırsız"
                  value={form.maxTotalBreakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, maxTotalBreakMinutes: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Boş bırakılan alanlar sınırsız kabul edilir — örn. yalnızca adet, yalnızca toplam süre ya da
              tamamen serbest tanımlayabilirsiniz.
            </p>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Standart çalışma saatleri (isteğe bağlı — yalnızca bilgi etiketi üretir, hiçbir kaydı engellemez)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Başlangıç</Label>
                  <Input
                    type="time"
                    value={form.standardStart}
                    onChange={(e) => setForm((f) => ({ ...f, standardStart: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bitiş</Label>
                  <Input
                    type="time"
                    value={form.standardEnd}
                    onChange={(e) => setForm((f) => ({ ...f, standardEnd: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              {target.kind === "user" ? (
                <Button variant="secondary" size="sm" onClick={() => setBulkConfirmOpen(true)} disabled={busy}>
                  Kaydedilmiş ayarları tüm ekibe uygula
                </Button>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                  Vazgeç
                </Button>
                <Button onClick={handleSave} disabled={busy}>
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {target?.kind === "user" && (
        <ConfirmDialog
          open={bulkConfirmOpen}
          onOpenChange={setBulkConfirmOpen}
          title="Tüm ekibe uygula"
          description={`${target.userName} için kaydedilmiş ara hakkı ayarları, takımdaki tüm üyelerin kişiye özel ayarının üzerine yazılarak uygulanacak. Bu işlem, önce "Kaydet" ile veritabanına yazılmış son ayarları kullanır. Devam edilsin mi?`}
          confirmLabel="Tüm Ekibe Uygula"
          destructive={false}
          onConfirm={handleBulkApply}
        />
      )}
    </>
  );
}

export type { SettingsTarget };
