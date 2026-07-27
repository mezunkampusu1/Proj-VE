"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, FolderPlus, Search, Star, Sparkles, Archive, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderTree, type FolderNode } from "@/components/ortak-alan/folder-tree";
import { NewDocumentDialog } from "@/components/ortak-alan/new-document-dialog";
import { NewFolderDialog } from "@/components/ortak-alan/new-folder-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
  teamId: string;
}

/**
 * Ortak Alan'ın SOL kenar çubuğu — daha önce yalnızca ana ekranda
 * (main-view.tsx) render ediliyordu; Ara/Favoriler/Arşiv/Çöp Kutusu gibi
 * ayrı sayfalara geçildiğinde tamamen kayboluyordu (bkz. görev #187 —
 * kullanıcı ekran görüntüsüyle bildirdi). Artık `(list)` rota grubu için
 * ortak bir layout.tsx üzerinden TÜM bu sayfalarda kalıcı olarak render
 * edilir. Klasör/Şablonlar tıklamaları artık yerel state yerine ana ekrana
 * (`/ortak-alan?...`) YÖNLENDİRME ile çalışır — böylece hangi sayfada
 * olursanız olun tutarlı çalışır.
 */
export function OrtakAlanSidebar({ isAdmin, teamId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const onMainPage = pathname === "/ortak-alan";
  const activeFolderId = onMainPage ? searchParams.get("folderId") : null;
  const activeScope = onMainPage ? searchParams.get("scope") : null;

  const loadFolders = async () => {
    try {
      const res = await fetch("/api/document-folders");
      const json = await res.json();
      setFolders(json.folders ?? []);
    } catch {
      toast.error("Klasörler yüklenemedi.");
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const selectFolder = (folderId: string | null) => {
    router.push(folderId ? `/ortak-alan?folderId=${folderId}` : "/ortak-alan");
  };

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-accent font-medium text-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  return (
    <aside className="space-y-4">
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1" onClick={() => setNewDocOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Yeni
        </Button>
        <Button size="icon" variant="secondary" title="Yeni klasör" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <nav className="space-y-0.5">
        <Link href="/ortak-alan/search" className={navLinkClass("/ortak-alan/search")}>
          <Search className="h-4 w-4" /> Ara
        </Link>
        <Link href="/ortak-alan/favorites" className={navLinkClass("/ortak-alan/favorites")}>
          <Star className="h-4 w-4" /> Favoriler
        </Link>
        <button
          onClick={() => router.push("/ortak-alan?scope=templates")}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
            activeScope === "templates" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Sparkles className="h-4 w-4" /> Şablonlar
        </button>
        <Link href="/ortak-alan/archive" className={navLinkClass("/ortak-alan/archive")}>
          <Archive className="h-4 w-4" /> Arşiv
        </Link>
        <Link href="/ortak-alan/trash" className={navLinkClass("/ortak-alan/trash")}>
          <Trash2 className="h-4 w-4" /> Çöp Kutusu
        </Link>
        {isAdmin && (
          <Link href="/ortak-alan/admin" className={navLinkClass("/ortak-alan/admin")}>
            <Settings className="h-4 w-4" /> Yönetim
          </Link>
        )}
      </nav>

      <div className="border-t border-border pt-3">
        <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">Klasörler</p>
        <FolderTree folders={folders} selectedFolderId={activeFolderId} onSelect={selectFolder} />
      </div>

      <NewDocumentDialog
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        folderId={activeFolderId}
        teamId={teamId}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        parentFolderId={activeFolderId}
        onCreated={loadFolders}
      />
    </aside>
  );
}
