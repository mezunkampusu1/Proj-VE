"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { History, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface VersionItem {
  id: string;
  label: string | null;
  isAutoSnapshot: boolean;
  createdAt: string;
  contentText: string | null;
  createdBy: { id: string; name: string | null; email: string };
}

/**
 * Sürüm Geçmişi paneli (§8). "Bu Sürüme Geri Dön" ASLA yıkıcı değildir:
 * sunucu önce mevcut durumu otomatik yedekler, sonra bu bileşen hedef
 * sürümün içeriğini `editor.commands.setContent(...)` ile canlı belgeye
 * yazar (Yjs üzerinden tüm bağlı kullanıcılara anında yayılır).
 */
export function VersionHistoryPanel({ documentId, editor, canEdit }: { documentId: string; editor: Editor | null; canEdit: boolean }) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelInput, setLabelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/documents/${documentId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const saveVersion = async () => {
    if (!labelInput.trim()) {
      toast.error("Sürüm için bir ad girin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelInput.trim() }),
      });
      if (!res.ok) throw new Error();
      setLabelInput("");
      toast.success("Sürüm kaydedildi.");
      load();
    } catch {
      toast.error("Sürüm kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!editor) return;
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      editor.commands.setContent(data.content);
      toast.success(`"${data.label || "Seçilen sürüm"}" geri yüklendi. Önceki durum otomatik yedeklendi.`);
      load();
    } catch {
      toast.error("Sürüm geri yüklenemedi.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium text-foreground">
        <History className="h-4 w-4" />
        Sürüm Geçmişi
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
        {!loading && versions.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz sürüm kaydı yok.</p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {v.label || (v.isAutoSnapshot ? "Otomatik anlık görüntü" : "Adsız sürüm")}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar name={v.createdBy.name} email={v.createdBy.email} size={16} />
                  <span className="truncate">{v.createdBy.name || v.createdBy.email}</span>
                  <span>· {formatRelativeTime(v.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(v.createdAt)}</p>
              </div>
              {canEdit && editor && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={restoringId === v.id}
                  onClick={() => restore(v.id)}
                  title="Bu sürüme geri dön"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="space-y-1.5 border-t border-border px-4 py-3">
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Sürüm adı (örn. İlk taslak)"
            className="w-full rounded-lg border border-input bg-secondary/40 px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={saving} onClick={saveVersion}>
              <Save className="h-3.5 w-3.5" /> Sürüm Kaydet
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
