"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, X, Lightbulb } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface SuggestionItem {
  id: string;
  type: "INSERT" | "DELETE" | "FORMAT" | "MOVE";
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  originalText: string | null;
  suggestedText: string | null;
  note: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
}

const TYPE_LABELS: Record<string, string> = {
  INSERT: "Ekleme",
  DELETE: "Silme",
  FORMAT: "Biçim",
  MOVE: "Taşıma",
};

/**
 * Öneri (track-changes) listesi + kabul/red kontrolleri. `editor` prop'u
 * doğrudan geçirilir çünkü INSERT/DELETE kabul/red işlemleri Yjs belgesini
 * canlı olarak değiştirmek için editör komutlarını kullanır (bkz.
 * suggestion-mode-extension.ts) — bu yüzden bu panel, sağdaki genel
 * Yorumlar panelinden farklı olarak editörle aynı bileşen ağacında tutulur.
 */
export function SuggestionsPanel({ editor, documentId }: { editor: Editor | null; documentId: string }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/documents/${documentId}/suggestions?status=PENDING`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  const decide = async (suggestion: SuggestionItem, decision: "ACCEPTED" | "REJECTED") => {
    const res = await fetch(`/api/documents/${documentId}/suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error || "İşlem başarısız.");
      return;
    }

    if ((suggestion.type === "INSERT" || suggestion.type === "DELETE") && editor) {
      if (decision === "ACCEPTED") {
        editor.commands.acceptSuggestion(suggestion.id);
      } else {
        editor.commands.rejectSuggestion(suggestion.id);
      }
    }

    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  const pendingCount = suggestions.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          )}
          title="Öneriler"
        >
          <Lightbulb className="h-4 w-4" />
          Öneriler{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2" overlay>
        {loading && <p className="px-2 py-3 text-sm text-muted-foreground">Yükleniyor…</p>}
        {!loading && suggestions.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Bekleyen öneri yok.</p>
        )}
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{s.author.name || s.author.email}</span>
                <span>{formatRelativeTime(s.createdAt)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {TYPE_LABELS[s.type]}
                </span>
              </div>
              {s.originalText && (
                <p className="mt-1 truncate text-xs text-muted-foreground line-through">{s.originalText}</p>
              )}
              {s.suggestedText && <p className="mt-0.5 truncate text-xs text-foreground">{s.suggestedText}</p>}
              {s.note && <p className="mt-1 text-xs text-foreground/80">{s.note}</p>}
              <div className="mt-2 flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => decide(s, "REJECTED")}>
                  <X className="h-3.5 w-3.5" /> Reddet
                </Button>
                <Button size="sm" onClick={() => decide(s, "ACCEPTED")}>
                  <Check className="h-3.5 w-3.5" /> Kabul Et
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
