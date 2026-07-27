"use client";

import { useEffect, useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Template {
  id: string;
  title: string;
  active: boolean;
  column: { id: string; name: string };
  assignees: { id: string; name: string | null; email: string }[];
}

export function RecurringTemplatesModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/projects/${projectId}/recurring-templates`)
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function toggleActive(id: string, active: boolean) {
    setTemplates((t) => t.map((tpl) => (tpl.id === id ? { ...tpl, active } : tpl)));
    await fetch(`/api/projects/${projectId}/recurring-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function remove(id: string) {
    setTemplates((t) => t.filter((tpl) => tpl.id !== id));
    await fetch(`/api/projects/${projectId}/recurring-templates/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
  }

  return (
    <Modal open={open} onClose={onClose} title="Her Gün Tekrarlayan Görevler">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Buradaki her şablon için her gün panoya otomatik yeni bir görev eklenir — geçmiş
          günlerin kendi kaydı/tamamlanma durumu ayrı ayrı korunur. Bir şablonu geçici olarak
          durdurmak için pasif yapabilir, tamamen kaldırmak için silebilirsiniz (geçmişte
          türetilmiş görevler silinmez).
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : templates.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            Henüz tekrarlayan görev şablonu yok. Bir görev oluştururken &ldquo;Her gün
            tekrarla&rdquo; seçeneğini işaretleyerek ekleyebilirsiniz.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{tpl.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {tpl.column.name}
                      {tpl.assignees.length > 0 &&
                        ` · ${tpl.assignees.map((a) => a.name || a.email).join(", ")}`}
                    </p>
                  </div>
                  {!tpl.active && <Badge tone="slate">Pasif</Badge>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={tpl.active}
                      onChange={(e) => toggleActive(tpl.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(tpl.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    aria-label={`${tpl.title} şablonunu sil`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        description="Bu tekrarlayan görev şablonunu silmek istediğinize emin misiniz? Geçmişte türetilmiş görevler silinmez."
        onConfirm={() => confirmDeleteId && remove(confirmDeleteId)}
      />
    </Modal>
  );
}
