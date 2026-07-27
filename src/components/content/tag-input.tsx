"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Basit dizi (string[]) girişi — hashtag/anahtar kelime/hesap adı gibi
 * alanlar için. Codebase'de hazır bir "chip input" bileşeni yoktu; en yakın
 * örnek olan `AssigneePicker`'ın çip deseni referans alınmıştır, ama bu
 * bileşen kullanıcı/varlık ID'si değil DÜZ METİN üretir (bkz. proje talebi
 * §5 — hashtags/keywords/mentionAccounts alanları serbest metin dizisidir).
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  prefix,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Örn. "#" — çiplerde ve eklerken otomatik önek gösterir (hashtag alanı için). */
  prefix?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const raw = draft.trim().replace(/^#/, "");
    if (!raw) return;
    const tag = prefix ? `${prefix}${raw}` : raw;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2 pr-1 text-xs font-medium text-foreground/90">
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded-full p-0.5 hover:bg-background/60"
            aria-label={`${tag} kaldır`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : "Ekle..."}
        className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
