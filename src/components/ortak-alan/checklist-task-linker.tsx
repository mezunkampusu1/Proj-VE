"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ListPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Belgede `documentBlockId`'ye sahip taskItem düğümünün GÜNCEL konumunu bulur. */
function findTaskItemPos(editor: Editor, blockId: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "taskItem" && node.attrs.documentBlockId === blockId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * İmleç bir kontrol listesi maddesinin içindeyken tıklanır; maddeyi
 * MEVCUT görev modülünde bir göreve dönüştürür ve düğüme `linkedTaskId`
 * yazar (§7). Teams/projeler arasında editörün her an yeniden render
 * olmasını gerektirmemek için "context-sensitive" bir araç çubuğu
 * öğesi yerine, tıklama anında `editor.isActive('taskItem')` kontrolü
 * yapan basit bir buton kullanılır.
 */
export function ChecklistTaskLinker({ editor, documentId }: { editor: Editor | null; documentId: string }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        const teamId = data?.document?.teamId;
        if (!teamId) return;
        return fetch(`/api/teams/${teamId}/projects`)
          .then((r) => r.json())
          .then((d) => setProjects(d.projects || []));
      })
      .catch(() => {});
  }, [documentId]);

  /**
   * Popover'ı açma İSTEĞİNİ ele alır (bkz. handleOpenChange). Yalnızca
   * geçerli bir kontrol listesi maddesi bulunursa popover GERÇEKTEN açılır
   * — bulunamazsa `open` false'ta kalır.
   *
   * Kök neden (görev #174 — ekran görüntüleriyle doğrulandı): Radix'in
   * PopoverTrigger'ı `asChild` ile sarıldığında, tetikleyicideki `onClick`
   * doğrulaması BAŞARISIZ olsa (ör. imleç bir kontrol listesi maddesinde
   * değilken "Lütfen önce imleci..." hatası gösterildiğinde) bile Radix
   * kendi varsayılan aç/kapa davranışını AYRICA çalıştırıyordu — bu da
   * popover'ın boş/eski `pendingText`/`projectId` durumuyla açılmasına
   * (ekran görüntüsündeki "" maddesi..." ve seçili projeye rağmen "Bir
   * proje seçin" hatası) yol açıyordu. Çözüm: popover'ı tamamen kontrollü
   * hale getirip açma kararını doğrulamadan SONRA vermek — `onClick` yerine
   * `onOpenChange` üzerinden.
   */
  const startLinking = () => {
    if (!editor) return false;
    if (!editor.isActive("taskItem")) {
      toast.error("Lütfen önce imleci bir kontrol listesi maddesinin içine yerleştirin.");
      return false;
    }
    const { $from } = editor.state.selection;
    let node = null;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type.name === "taskItem") {
        node = n;
        break;
      }
    }
    if (!node) {
      toast.error("Kontrol listesi maddesi bulunamadı.");
      return false;
    }
    if (node.attrs.linkedTaskId) {
      toast.info("Bu madde zaten bir göreve bağlı.");
      return false;
    }

    let blockId = node.attrs.documentBlockId as string | null;
    if (!blockId) {
      blockId = genId();
      let itemPos: number | null = null;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "taskItem") {
          itemPos = $from.before(d);
          break;
        }
      }
      if (itemPos !== null) {
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(itemPos, undefined, { ...node.attrs, documentBlockId: blockId }),
        );
      }
    }

    // Önceki bir bağlama denemesinden kalan proje seçimini temizle — aksi
    // halde farklı bir maddeye tıklandığında eski proje sessizce seçili
    // görünmeye devam ediyordu.
    setProjectId("");
    setPendingBlockId(blockId);
    setPendingText(node.textContent.slice(0, 200));
    return true;
  };

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOpen(false);
      return;
    }
    if (startLinking()) setOpen(true);
  }

  const submit = async () => {
    if (!editor || !pendingBlockId || !projectId || !pendingText.trim()) {
      toast.error("Bir proje seçin.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/checklist-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pendingText, documentBlockId: pendingBlockId, projectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Sunucudan gelen gerçek hata nedenini göster (ör. "seçilen projede
        // henüz bir sütun yok" / yetki hatası) — önceden tüm hatalar tek bir
        // genel mesaja düşüyordu ve kullanıcı neden bağlanmadığını hiç
        // göremiyordu (bkz. görev #174: "göreve bağla dediğimizde
        // göreve bağlanmıyor").
        toast.error(data?.error || "Görev oluşturulamadı.");
        return;
      }

      const pos = findTaskItemPos(editor, pendingBlockId);
      if (pos === null) {
        // Görev veritabanında oluşturuldu ama belgede karşılık gelen madde
        // artık bulunamadı (ör. istek sürerken madde silindi) — bunu
        // "başarılı" gibi göstermek yanıltıcıydı; kullanıcıya gerçek
        // durumu bildiriyoruz.
        toast.warning("Görev oluşturuldu ancak kontrol listesi maddesi bağlı olarak işaretlenemedi. Sayfayı yenileyip tekrar deneyin.");
        setOpen(false);
        return;
      }
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, linkedTaskId: data.task.id }),
        );
      }

      toast.success("Kontrol listesi maddesi göreve bağlandı.");
      setOpen(false);
    } catch {
      toast.error("Görev oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" title="Kontrol listesi maddesini göreve bağla">
          <ListPlus className="h-3.5 w-3.5" />
          Göreve Bağla
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-3" overlay>
        <p className="text-xs text-muted-foreground">“{pendingText}” maddesi hangi projeye görev olarak eklensin?</p>
        {projects.length === 0 ? (
          <p className="rounded-md bg-secondary/60 px-2.5 py-2 text-xs text-muted-foreground">
            Bu ekipte henüz proje yok. Önce Görevler bölümünden bir proje oluşturun.
          </p>
        ) : (
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Proje seçin" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex justify-end">
          <Button size="sm" disabled={submitting || !projectId} onClick={submit}>
            Bağla
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
