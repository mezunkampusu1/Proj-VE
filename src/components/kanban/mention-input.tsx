"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TeamMemberOption } from "@/components/kanban/types";

const MENTION_TOKEN = /@\[([^\]]+)\]\([a-zA-Z0-9_-]+\)/g;
const MENTION_TOKEN_FULL = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

type MentionRef = { name: string; id: string };

/** Ham (id gömülü) metni okunabilir "@Ad" bicimine cevirir - kutuda gosterilecek metin budur. */
function toFriendly(raw: string): string {
  return raw.replace(MENTION_TOKEN_FULL, (_match, name: string) => "@" + name);
}

/** Ham metindeki etiketlemeleri {ad, id} listesi olarak cikarir. */
function parseMentions(raw: string): MentionRef[] {
  const list: MentionRef[] = [];
  for (const m of raw.matchAll(MENTION_TOKEN_FULL)) {
    list.push({ name: m[1], id: m[2] });
  }
  return list;
}

/**
 * Okunabilir "@Ad" metnini, bilinen etiketleme listesine gore tekrar ham
 * ("@[Ad](id)") bicime cevirir. Yalnizca gercekten secilmis (veya daha once
 * kaydedilmis) etiketlemeler donusturulur - kullanici bir uyenin adini
 * elle, oneri listesinden secmeden yazarsa etiketlemeye cevrilmez. En uzun
 * ad once eslestirilir ki "Ali" gibi kisa bir ad, "Ali Veli" gibi daha
 * uzun bir adin icine yanlislikla sizmasin.
 */
function toRaw(friendly: string, mentions: MentionRef[]): string {
  if (mentions.length === 0) return friendly;
  const dedupeMap = new Map<string, MentionRef>();
  for (const m of mentions) dedupeMap.set(m.name + "::" + m.id, m);
  const unique = Array.from(dedupeMap.values()).sort((a, b) => b.name.length - a.name.length);

  let result = friendly;
  const placeholders: { token: string; raw: string }[] = [];
  unique.forEach((m, i) => {
    const needle = "@" + m.name;
    if (result.includes(needle)) {
      const placeholder = "__MENTION_PLACEHOLDER_" + i + "__";
      result = result.split(needle).join(placeholder);
      placeholders.push({ token: placeholder, raw: "@[" + m.name + "](" + m.id + ")" });
    }
  });
  for (const p of placeholders) {
    result = result.split(p.token).join(p.raw);
  }
  return result;
}

/** Ham not/yorum metnini (`@[Ad](id)` belirteçleri dahil) okunabilir, etiketlemeleri
 * vurgulanmış bir metin bloğu olarak render eder. */
export function MentionText({ body, className }: { body: string; className?: string }) {
  const parts: { text: string; mention: boolean }[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: body.slice(lastIndex, index), mention: false });
    parts.push({ text: `@${match[1]}`, mention: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex), mention: false });

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((p, i) =>
        p.mention ? (
          <span key={i} className="font-medium text-primary">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * "@" yazıldığında ekip üyelerini öneren, seçileni metne gömen textarea.
 * Kutuda KULLANICIYA gösterilen değer her zaman okunabilir "@Ad" biçimidir
 * (bkz. görev #188 — önceden burada ham `@[Ad](id)` belirteci görünüyordu,
 * kullanıcı bunu "bozuk markdown" olarak bildirdi). Dışarıya (`onChange`)
 * ve API'ye giden değer değişmedi: hâlâ `@[Ad](userId)` biçiminde, kimlik
 * gömülü — ad/e-posta çakışmasında bile hangi kullanıcının etiketlendiği
 * belirsiz kalmasın diye (bkz. src/lib/tasks.ts extractMentionedUserIds).
 * Bu iki temsil arasındaki dönüşüm toFriendly/toRaw ile yapılır.
 */
export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  rows = 2,
  onEnterSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  members: TeamMemberOption[];
  placeholder?: string;
  rows?: number;
  onEnterSubmit?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Kutuda gösterilen okunabilir metin ("@Ad") ve bunun arkasındaki bilinen
  // etiketleme listesi. `value`/`onChange` (raw, `@[Ad](id)`) dışarıyla olan
  // sözleşme değişmedi; bu iki state yalnızca görüntü katmanı için.
  const [friendly, setFriendly] = useState<string>(() => toFriendly(value));
  const mentionsRef = useRef<MentionRef[]>(parseMentions(value));
  const lastRawRef = useRef<string>(value);

  // `value` prop'u BİZİM emitmediğimiz bir şekilde değiştiyse (ör. gönderim
  // sonrası üst bileşen alanı temizledi, ya da düzenleme moduna geçilip
  // farklı bir yorumun ham gövdesi yüklendi) görüntüyü ve etiketleme
  // listesini sıfırdan kur.
  useEffect(() => {
    if (value === lastRawRef.current) return;
    mentionsRef.current = parseMentions(value);
    setFriendly(toFriendly(value));
    lastRawRef.current = value;
  }, [value]);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members
      .filter((m) => (m.name || m.email).toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, query]);

  function detectMention(text: string, cursor: number) {
    const upToCursor = text.slice(0, cursor);
    const at = upToCursor.lastIndexOf("@");
    if (at === -1) return null;
    if (at > 0 && !/\s/.test(upToCursor[at - 1])) return null;
    const candidate = upToCursor.slice(at + 1);
    if (/\s/.test(candidate)) return null;
    return { start: at, query: candidate };
  }

  function emit(nextFriendly: string) {
    setFriendly(nextFriendly);
    const raw = toRaw(nextFriendly, mentionsRef.current);
    lastRawRef.current = raw;
    onChange(raw);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    emit(text);
    const cursor = e.target.selectionStart ?? text.length;
    const mention = detectMention(text, cursor);
    if (mention) {
      setQuery(mention.query);
      setTriggerStart(mention.start);
      setActiveIndex(0);
    } else {
      setQuery(null);
      setTriggerStart(null);
    }
  }

  function selectMember(member: TeamMemberOption) {
    if (triggerStart === null) return;
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? friendly.length;
    const before = friendly.slice(0, triggerStart);
    const after = friendly.slice(cursor);
    const label = member.name || member.email;
    const inserted = `@${label} `;
    const next = `${before}${inserted}${after}`;
    mentionsRef.current = [...mentionsRef.current, { name: label, id: member.id }];
    emit(next);
    setQuery(null);
    setTriggerStart(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      const pos = before.length + inserted.length;
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMember(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        setTriggerStart(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && onEnterSubmit) {
      e.preventDefault();
      onEnterSubmit();
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        rows={rows}
        value={friendly}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {query !== null && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-popover)]">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectMember(m)}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                i === activeIndex ? "bg-accent text-foreground" : "text-foreground/90 hover:bg-accent/60",
              )}
            >
              <Avatar name={m.name} email={m.email} size={20} />
              <span className="truncate">{m.name || m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
