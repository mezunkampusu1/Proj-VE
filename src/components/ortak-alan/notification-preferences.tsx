"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Preference {
  onShared: boolean;
  onMentioned: boolean;
  onComment: boolean;
  onApproval: boolean;
  onStatusChange: boolean;
}

const DEFAULT_PREF: Preference = {
  onShared: true,
  onMentioned: true,
  onComment: true,
  onApproval: true,
  onStatusChange: true,
};

const LABELS: Record<keyof Preference, string> = {
  onShared: "Bir doküman benimle paylaşıldığında",
  onMentioned: "Bir dokümanda/yorumda etiketlendiğimde",
  onComment: "Dokümanıma yorum yapıldığında",
  onApproval: "Onay talebi/kararı olduğunda",
  onStatusChange: "Takip ettiğim bir dokümanın durumu değiştiğinde",
};

/**
 * Ortak Alan bildirim tercihleri (§ bildirim türleri + tercihleri).
 * Herhangi bir ekip üyesi kendi tercihini değiştirebilir — Daily Flow'un
 * yalnızca yöneticiye açık tercih panelinin aksine, bu modülün bildirimleri
 * herhangi bir üyeye gidebildiği için buradaki panel HERKESE açıktır.
 */
export function NotificationPreferences() {
  const [pref, setPref] = useState<Preference>(DEFAULT_PREF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/documents/notification-preferences")
      .then((r) => r.json())
      .then((json) => {
        if (json.preference) {
          setPref({
            onShared: json.preference.onShared,
            onMentioned: json.preference.onMentioned,
            onComment: json.preference.onComment,
            onApproval: json.preference.onApproval,
            onStatusChange: json.preference.onStatusChange,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof Preference) => {
    const next = { ...pref, [key]: !pref[key] };
    setPref(next);
    setSaving(true);
    try {
      const res = await fetch("/api/documents/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPref(pref);
      toast.error("Tercih kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Bildirim tercihleri"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="end" overlay>
        <p className="text-sm font-medium text-foreground">Ortak Alan bildirimleri</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : (
          <div className="space-y-1.5">
            {(Object.keys(LABELS) as (keyof Preference)[]).map((key) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1">
                <span className="text-xs text-foreground">{LABELS[key]}</span>
                <Button
                  size="sm"
                  variant={pref[key] ? "primary" : "secondary"}
                  disabled={saving}
                  onClick={() => toggle(key)}
                  className={cn("h-6 shrink-0 px-2 text-[11px]")}
                >
                  {pref[key] ? "Açık" : "Kapalı"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
