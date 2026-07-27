"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Star, ArchiveRestore, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { documentStatusLabel, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface DocumentRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  deletedAt?: string | null;
  type: { id: string; name: string } | null;
  folder: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string | null };
}

type Mode = "favorites" | "archive" | "trash";

interface Props {
  mode: Mode;
  isAdmin: boolean;
}

const EMPTY_MESSAGE: Record<Mode, string> = {
  favorites: "Henüz favori eklemediniz.",
  archive: "Arşivde doküman yok.",
  trash: "Çöp kutusu boş.",
};

const TITLE: Record<Mode, string> = {
  favorites: "Favoriler",
  archive: "Arşiv",
  trash: "Çöp Kutusu",
};

/**
 * Favoriler / Arşiv / Çöp Kutusu için ortak liste görünümü (§ favoriler,
 * sabitleme, arşiv, çöp kutusu ekranları). Ana ekrandaki (main-view.tsx)
 * kenar çubuğundan bağlantı verilir; kendi başlarına bağımsız sayfalar
 * olarak kalırlar (geri dönüş linki ana ekranın kenar çubuğundadır).
 */
export function DocumentListView({ mode, isAdmin }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = mode === "favorites" ? "favorites=1" : mode === "archive" ? "scope=archive" : "scope=trash";
      const res = await fetch(`/api/documents?${params}`);
      const json = await res.json();
      setDocuments(json.documents ?? []);
    } catch {
      toast.error("Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const unfavorite = async (id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/documents/${id}/favorite`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Favorilerden çıkarılamadı.");
      load();
    }
  };

  const unarchive = async (id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/documents/${id}/archive`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Doküman arşivden çıkarıldı.");
    } catch {
      toast.error("Arşivden çıkarılamadı.");
      load();
    }
  };

  const restore = async (id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/documents/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Doküman geri yüklendi.");
    } catch {
      toast.error("Geri yükleme başarısız oldu.");
      load();
    }
  };

  const permanentDelete = async (id: string) => {
    setConfirmPermanentId(null);
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/documents/${id}/permanent`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Doküman kalıcı olarak silindi.");
    } catch {
      toast.error("Kalıcı silme başarısız oldu.");
      load();
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-foreground">{TITLE[mode]}</h1>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
      ) : documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{EMPTY_MESSAGE[mode]}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
              <Link href={`/ortak-alan/${doc.id}`} className="flex min-w-0 flex-1 items-start gap-2.5 hover:opacity-80">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{doc.title || "Adsız doküman"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {doc.type && <span className="rounded-full bg-secondary px-2 py-0.5">{doc.type.name}</span>}
                    <span>{doc.owner.name || doc.owner.email}</span>
                    <span>{formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: tr })}</span>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn("hidden rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground sm:inline")}>
                  {documentStatusLabel(doc.status)}
                </span>
                {mode === "favorites" && (
                  <Button size="icon" variant="ghost" title="Favorilerden çıkar" onClick={() => unfavorite(doc.id)}>
                    <Star className="h-4 w-4 fill-current text-amber-500" />
                  </Button>
                )}
                {mode === "archive" && (
                  <Button size="icon" variant="ghost" title="Arşivden çıkar" onClick={() => unarchive(doc.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                  </Button>
                )}
                {mode === "trash" && (
                  <>
                    <Button size="icon" variant="ghost" title="Geri yükle" onClick={() => restore(doc.id)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" title="Kalıcı sil" onClick={() => setConfirmPermanentId(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmPermanentId}
        onOpenChange={(open) => !open && setConfirmPermanentId(null)}
        title="Dokümanı kalıcı olarak sil"
        description="Bu işlem geri alınamaz. Doküman ve tüm ilişkili verileri kalıcı olarak silinecek."
        confirmLabel="Kalıcı Sil"
        destructive
        onConfirm={() => confirmPermanentId && permanentDelete(confirmPermanentId)}
      />
    </div>
  );
}
