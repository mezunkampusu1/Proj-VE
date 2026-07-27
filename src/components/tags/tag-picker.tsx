"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagBadge } from "@/components/tags/tag-badge";
import { TAG_COLOR_PALETTE } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

/**
 * İş geliştirme fikir takibi için hazır etiket önerileri — Projelendirme
 * panosunu aynı zamanda bir "fikir/öneri" panosu olarak da kullanabilmek
 * için (bkz. kullanıcı talebi: Görevler'i Projelendirme'ye çevirip aynı
 * anda iş geliştirme takibi için de kullanma isteği). Zaten seçili olan
 * veya sistemde aynı isimle var olan bir etiketle çakışırsa mevcut olan
 * kullanılır — yinelenen etiket OLUŞTURULMAZ.
 */
const SUGGESTED_TAGS: { name: string; color: string }[] = [
  { name: "💡 Fikir", color: TAG_COLOR_PALETTE[2] },
  { name: "Değerlendiriliyor", color: TAG_COLOR_PALETTE[5] },
  { name: "Onaylandı", color: TAG_COLOR_PALETTE[6] },
  { name: "Reddedildi", color: TAG_COLOR_PALETTE[4] },
  { name: "Yol Haritası", color: TAG_COLOR_PALETTE[1] },
];

/**
 * Genel amaçlı etiket seçici. Görev, duyuru, tarih, Atlas programı gibi
 * farklı varlık türlerinde kullanılabilmesi için ekle/çıkar işlemleri
 * dışarıdan (onAttach/onDetach) enjekte edilir — bileşen hangi API uç
 * noktasının çağrılacağını bilmez.
 */
export function TagPicker({
  selected,
  onAttach,
  onDetach,
}: {
  selected: Tag[];
  onAttach: (tagId: string) => Promise<void>;
  onDetach: (tagId: string) => Promise<void>;
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [pickerValue, setPickerValue] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLOR_PALETTE[1]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  const availableTags = allTags.filter((t) => !selected.some((s) => s.id === t.id));
  const availableSuggestions = SUGGESTED_TAGS.filter(
    (s) => !selected.some((sel) => sel.name.toLowerCase() === s.name.toLowerCase()),
  );

  async function handleAttachExisting() {
    if (!pickerValue) return;
    setBusy(true);
    await onAttach(pickerValue);
    setPickerValue("");
    setBusy(false);
  }

  /** Aynı isimde etiket zaten varsa onu kullanır, yoksa oluşturup ekler. */
  async function createOrAttach(name: string, color: string) {
    setBusy(true);
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await onAttach(existing.id);
      setBusy(false);
      return;
    }
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      const { tag } = await res.json();
      setAllTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      await onAttach(tag.id);
    }
    setBusy(false);
  }

  async function handleCreateAndAttach() {
    if (!newTagName.trim()) return;
    await createOrAttach(newTagName.trim(), newTagColor);
    setNewTagName("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color}>
            <button
              type="button"
              onClick={() => onDetach(tag.id)}
              className="rounded-full p-0.5 hover:bg-background/60"
              aria-label={`${tag.name} etiketini kaldır`}
            >
              <X className="h-3 w-3" />
            </button>
          </TagBadge>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">Henüz etiket eklenmedi.</span>
        )}
      </div>

      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Öneri (iş geliştirme):</span>
          {availableSuggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              disabled={busy}
              onClick={() => createOrAttach(s.name, s.color)}
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-foreground/80 transition-colors hover:border-solid hover:bg-muted disabled:opacity-50"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {availableTags.length > 0 && (
          <div className="flex items-center gap-1.5">
            <SimpleSelect
              value={pickerValue}
              onValueChange={setPickerValue}
              triggerClassName="h-8 w-40 text-xs"
              placeholder="Mevcut etiket seç..."
              options={availableTags.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!pickerValue || busy}
              onClick={handleAttachExisting}
            >
              Ekle
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Yeni etiket"
            className="h-8 w-32 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateAndAttach();
              }
            }}
          />
          <div className="flex items-center gap-1">
            {TAG_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewTagColor(c)}
                aria-label={`Renk: ${c}`}
                className={cn(
                  "h-5 w-5 shrink-0 rounded-full ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                  newTagColor === c && "ring-2 ring-foreground",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!newTagName.trim() || busy}
            onClick={handleCreateAndAttach}
          >
            Oluştur
          </Button>
        </div>
      </div>
    </div>
  );
}
