"use client";

import { useEffect, useRef } from "react";

// Görevlendirme #200: "kalın punto emoji v.s. desteklesin ... çok önemli"
// isteği için elle seçilmiş, sık kullanılan küçük bir emoji seti — ayrı bir
// npm paketi (ör. emoji-mart) eklemeden, Docker imajını büyütmeden basit
// bir açılır panel olarak sunulur.
const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😎", "🤔",
  "😅", "😢", "😭", "😡", "😱", "🥳", "🙌", "👏",
  "👍", "👎", "🙏", "💪", "✅", "❌", "⚠️", "🔥",
  "🎉", "❤️", "💯", "⭐", "📌", "📎", "🚀", "⏰",
];

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-1 grid w-56 grid-cols-8 gap-0.5 rounded-lg border border-border bg-popover p-2 shadow-[var(--shadow-popover)]"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(emoji)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-accent"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
