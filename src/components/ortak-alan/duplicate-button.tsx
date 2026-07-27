"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Kopyalama seçenekleri popover'ı (§ kopyalama). Başarılı kopyalamanın ardından yeni dokümana yönlendirir. */
export function DuplicateButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [includeComments, setIncludeComments] = useState(false);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includePermissions, setIncludePermissions] = useState(false);
  const [saving, setSaving] = useState(false);

  const duplicate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeComments, includeTasks, includePermissions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Doküman kopyalandı.");
      router.push(`/ortak-alan/${json.document.id}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Kopyalanamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Kopyala"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Copy className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="end" overlay>
        <p className="text-sm font-medium text-foreground">Dokümanı kopyala</p>
        <div className="space-y-1.5 text-xs text-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} />
            Yorumları dahil et
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeTasks} onChange={(e) => setIncludeTasks(e.target.checked)} />
            Bağlı görevleri kopyala
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includePermissions} onChange={(e) => setIncludePermissions(e.target.checked)} />
            Paylaşım yetkilerini dahil et
          </label>
        </div>
        <Button size="sm" className="w-full" disabled={saving} onClick={duplicate}>
          Kopyala
        </Button>
      </PopoverContent>
    </Popover>
  );
}
