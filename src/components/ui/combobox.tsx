"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

// Aynı anda DOM'a basılan seçenek sayısının üst sınırı. Üniversite listesi
// 2000'i aştığında tüm seçenekleri tek seferde render etmek kaydırmayı
// (scroll) gözle görülür şekilde takılmalı hale getiriyordu — kullanıcı
// geri bildirimi: "çok fazla üniversite gelince artarda kayacak". Ek bir
// virtualization kütüphanesi eklemeden (teknoloji kısıtı), en alakalı ilk
// N sonucu gösterip kullanıcıyı aramaya yönlendirmek performansı çözüyor.
const RENDER_LIMIT = 60;

/**
 * Aranabilir, temalı tek-seçim bileşeni. Radix Select (bkz. `select.tsx`)
 * kısa listeler için yeterli olsa da, üniversite gibi yüzlerce/binlerce
 * seçenekli listelerde kaydırma yerine arama gerekir. `cmdk` gibi ek bir
 * bağımlılık eklemeden Popover + basit filtreleme ile aynı deneyimi sağlar.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seçin...",
  searchPlaceholder = "Ara...",
  emptyText = "Sonuç bulunamadı.",
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  // Boş değerli "Tümü / Seçin..." gibi seçenekler her zaman en üstte sabit
  // kalır; geri kalanı alfabetik sıralanır ki uzun listede tarama kolaylaşsın.
  const sortedOptions = useMemo(() => {
    const pinned = options.filter((o) => o.value === "");
    const rest = options
      .filter((o) => o.value !== "")
      .sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
    return [...pinned, ...rest];
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return sortedOptions;
    return sortedOptions.filter((o) => o.label.toLocaleLowerCase("tr-TR").includes(q));
  }, [sortedOptions, query]);

  const visible = filtered.slice(0, RENDER_LIMIT);
  const hiddenCount = filtered.length - visible.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">{emptyText}</p>
          )}
          {visible.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                o.value === value && "bg-accent/60",
              )}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
        {hiddenCount > 0 && (
          <p className="border-t border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
            +{hiddenCount} sonuç daha var — daraltmak için yazmaya devam edin
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
