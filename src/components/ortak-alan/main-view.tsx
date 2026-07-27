"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, FileText, Star, Pin, LayoutGrid, List as ListIcon, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewDocumentDialog } from "@/components/ortak-alan/new-document-dialog";
import { ShareDialog } from "@/components/ortak-alan/share-dialog";
import { documentStatusLabel, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface DocumentRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  isPinned: boolean;
  type: { id: string; name: string } | null;
  folder: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string | null };
  _count?: { comments: number; favorites: number };
}

type Scope = "default" | "mine" | "shared" | "team" | "templates";

interface Props {
  isAdmin: boolean;
  teamId: string;
  currentUserId: string;
}

const SCOPE_LABELS: Record<Scope, string> = {
  default: "Tümü",
  mine: "Benim",
  shared: "Benimle Paylaşılan",
  team: "Tüm Ekip",
  templates: "Şablonlar",
};

/**
 * Ortak Alan ana ekranı: doküman listesi/kart görünümü (§ ana ekran).
 * Klasör ağacı ve Favoriler/Arşiv/Çöp Kutusu/Şablonlar gezinmesi artık
 * paylaşılan kenar çubuğunda yaşıyor (bkz. ortak-alan-sidebar.tsx +
 * (list)/layout.tsx — görev #187). Bu bileşen klasör/kapsam seçimini
 * kendi yerel state'i yerine URL'den (?folderId=&scope=) okur, böylece
 * kenar çubuğundaki bir bağlantıya tıklamak (hangi sayfada olursanız
 * olun) doğru filtreyle buraya yönlendirir.
 */
export function MainView({ isAdmin, teamId, currentUserId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get("folderId");
  const scope = (searchParams.get("scope") as Scope | null) || "default";

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Kullanıcı geri bildirimi: doküman oluşturduktan sonra birini ekleyip
  // görmesini sağlayacak bir yer bulamıyordu — Paylaş modalı sadece
  // dokümanın içinde, küçük bir ikon olarak vardı. Artık kart üzerinden de
  // doğrudan açılabiliyor.
  const [shareTarget, setShareTarget] = useState<DocumentRow | null>(null);

  const openShare = (doc: DocumentRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareTarget(doc);
  };

  const canManageShare = (doc: DocumentRow) => isAdmin || doc.owner.id === currentUserId;

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (selectedFolderId) params.set("folderId", selectedFolderId);
      const res = await fetch(`/api/documents?${params.toString()}`);
      const json = await res.json();
      setDocuments(json.documents ?? []);
    } catch {
      toast.error("Dokümanlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedFolderId]);

  const toggleFavorite = async (doc: DocumentRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/documents/${doc.id}/favorite`, { method: "POST" });
      toast.success("Favorilere eklendi.");
    } catch {
      toast.error("İşlem başarısız oldu.");
    }
  };

  const requestDelete = (doc: DocumentRow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(doc);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Doküman silinemedi.");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success("Doküman çöp kutusuna taşındı.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Doküman silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  const setScope = (next: Scope) => {
    const params = new URLSearchParams();
    params.set("scope", next);
    if (selectedFolderId) params.set("folderId", selectedFolderId);
    router.push(`/ortak-alan?${params.toString()}`);
  };

  const scopeTabs: Scope[] = isAdmin ? ["default", "mine", "shared", "team"] : ["default", "mine", "shared"];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
          {scopeTabs.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-1 rounded-lg bg-secondary p-1">
          <button
            onClick={() => setView("grid")}
            className={cn("rounded-md p-1.5", view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("rounded-md p-1.5", view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bu görünümde henüz doküman yok.</p>
          <Button size="sm" onClick={() => setNewDocOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> İlk dokümanı oluştur
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/ortak-alan/${doc.id}`}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  {doc.isPinned && <Pin className="h-3.5 w-3.5 fill-current text-primary" />}
                  <button onClick={(e) => toggleFavorite(doc, e)} className="opacity-0 group-hover:opacity-100">
                    <Star className="h-3.5 w-3.5 text-muted-foreground hover:fill-current hover:text-amber-500" />
                  </button>
                  <button
                    onClick={(e) => openShare(doc, e)}
                    className="opacity-0 group-hover:opacity-100"
                    title="Paylaş"
                  >
                    <Share2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  </button>
                  <button
                    onClick={(e) => requestDelete(doc, e)}
                    className="opacity-0 group-hover:opacity-100"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
              <p className="line-clamp-2 font-medium text-foreground">{doc.title || "Adsız doküman"}</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {doc.type && <span className="rounded-full bg-secondary px-2 py-0.5">{doc.type.name}</span>}
                <span className="rounded-full border border-border px-2 py-0.5">{documentStatusLabel(doc.status)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {doc.owner.name || doc.owner.email} · {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: tr })}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/ortak-alan/${doc.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                    {doc.isPinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary" />}
                    {doc.title || "Adsız doküman"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {doc.folder?.name || "Kök"} · {doc.owner.name || doc.owner.email}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">{documentStatusLabel(doc.status)}</span>
                <span>{formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: tr })}</span>
                <button
                  onClick={(e) => openShare(doc, e)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="Paylaş"
                >
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </button>
                <button
                  onClick={(e) => requestDelete(doc, e)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewDocumentDialog
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        folderId={selectedFolderId}
        teamId={teamId}
      />
      {shareTarget && (
        <ShareDialog
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          documentId={shareTarget.id}
          teamId={teamId}
          canManage={canManageShare(shareTarget)}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
        title="Doküman silinsin mi?"
        description={`"${deleteTarget?.title || "Adsız doküman"}" çöp kutusuna taşınacak. Çöp Kutusu'ndan geri yükleyebilirsiniz.`}
        confirmLabel={deleting ? "Siliniyor…" : "Sil"}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
