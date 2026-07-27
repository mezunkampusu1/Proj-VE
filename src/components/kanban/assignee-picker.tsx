"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeamMemberOption } from "@/components/kanban/types";

interface SelectedMember {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

/**
 * Çoklu atama seçici (bkz. görev #196 — "bazen 3 kişiye de atayabilirim,
 * atamaları direkt @ ile yapabilelim"). Seçili kişiler avatar+isim çipleri
 * olarak gösterilir; alttaki metin kutusuna "@" veya doğrudan bir isim
 * yazıldığında ekip üyeleri arasından öneri açılır — tıklama/Enter ile o
 * kişi çipe eklenir, kutu temizlenir. Yorumlardaki @mention deneyimiyle
 * (bkz. mention-input.tsx) aynı hissi verir, ama burada metne gömülü bir
 * belirteç değil, ayrı bir kimlik listesi (assigneeIds) üretilir.
 */
export function AssigneePicker({
  selected,
  members,
  onChange,
}: {
  selected: SelectedMember[];
  members: TeamMemberOption[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const suggestions = useMemo(() => {
    const q = query.replace(/^@/, "").trim().toLowerCase();
    return members
      .filter((m) => !selectedIds.has(m.id))
      .filter((m) => (q === "" ? true : (m.name || m.email).toLowerCase().includes(q)))
      .slice(0, 8);
  }, [members, query, selectedIds]);

  function addMember(member: TeamMemberOption) {
    onChange([...selected.map((s) => s.id), member.id]);
    setQuery("");
    inputRef.current?.focus();
  }

  function removeMember(id: string) {
    onChange(selected.filter((s) => s.id !== id).map((s) => s.id));
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-0.5 pr-1.5 text-xs font-medium text-foreground/90"
          >
            <Avatar name={m.name} email={m.email} image={m.image} size={18} />
            <span className="max-w-[7rem] truncate">{m.name || m.email}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeMember(m.id);
              }}
              className="rounded-full p-0.5 hover:bg-background/60"
              aria-label={`${m.name || m.email} atamasını kaldır`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && query === "" && selected.length > 0) {
              removeMember(selected[selected.length - 1].id);
            }
            if (e.key === "Enter" && open && suggestions.length > 0) {
              e.preventDefault();
              addMember(suggestions[0]);
            }
          }}
          placeholder={selected.length === 0 ? "@ ile ekip arkadaşı ekle..." : "Ekle..."}
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-popover)]">
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addMember(m)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground/90 hover:bg-accent/60",
              )}
            >
              <Avatar name={m.name} email={m.email} image={m.image} size={20} />
              <span className="truncate">{m.name || m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
