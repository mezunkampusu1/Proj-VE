"use client";

import { useState } from "react";
import { Star, Pin, Archive, ArchiveRestore } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  documentId: string;
  initialIsFavorite: boolean;
  initialIsPinned: boolean;
  initialIsArchived: boolean;
  canPin: boolean;
}

/**
 * Doküman başlığındaki hızlı aksiyon düğmeleri: favori (kişisel),
 * sabitleme (paylaşılan, EDITOR+ gerektirir), arşivleme (EDITOR+
 * gerektirir) — bkz. §18/§17. Ana Ekran'daki kart görünümünde de aynı
 * simgeler kullanılacak (tutarlılık için, ayrı görev).
 */
export function DocumentQuickActions({ documentId, initialIsFavorite, initialIsPinned, initialIsArchived, canPin }: Props) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [isArchived, setIsArchived] = useState(initialIsArchived);
  const [busy, setBusy] = useState(false);

  const toggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      const res = await fetch(`/api/documents/${documentId}/favorite`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setIsFavorite(!next);
      toast.error("İşlem başarısız oldu.");
    }
  };

  const togglePin = async () => {
    if (busy) return;
    const next = !isPinned;
    setBusy(true);
    setIsPinned(next);
    try {
      const res = await fetch(`/api/documents/${documentId}/pin`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setIsPinned(!next);
      toast.error("İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    if (busy) return;
    const next = !isArchived;
    setBusy(true);
    setIsArchived(next);
    try {
      const res = await fetch(`/api/documents/${documentId}/archive`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(next ? "Doküman arşivlendi." : "Doküman arşivden çıkarıldı.");
    } catch {
      setIsArchived(!next);
      toast.error("İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={toggleFavorite}
        title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Star className={cn("h-4 w-4", isFavorite && "fill-current text-amber-500")} />
      </button>
      {canPin && (
        <>
          <button
            onClick={togglePin}
            title={isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pin className={cn("h-4 w-4", isPinned && "fill-current text-primary")} />
          </button>
          <button
            onClick={toggleArchive}
            title={isArchived ? "Arşivden çıkar" : "Arşivle"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4 text-primary" /> : <Archive className="h-4 w-4" />}
          </button>
        </>
      )}
    </div>
  );
}
