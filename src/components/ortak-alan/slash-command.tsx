"use client";

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: (props: { editor: Editor; range: Range }) => void;
}

/**
 * "/" komut menüsü — spesifikasyondaki (§4) "gelişmiş metin editörü,
 * '/' komut menüsü ile hızlı blok ekleme" gereksinimi. Tippy.js gibi ek
 * bir konumlandırma kütüphanesi eklemeden, öğenin caret konumundaki
 * clientRect'ini doğrudan kullanarak sabit konumlu bir açılır menü
 * gösterir (bkz. render() altındaki manuel konumlandırma).
 */
const ALL_ITEMS: SlashItem[] = [
  {
    title: "Başlık 1",
    description: "Büyük bölüm başlığı",
    icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Başlık 2",
    description: "Orta boy bölüm başlığı",
    icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Başlık 3",
    description: "Küçük bölüm başlığı",
    icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Madde İşaretli Liste",
    description: "Sıralanmamış liste oluştur",
    icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numaralı Liste",
    description: "Sıralı liste oluştur",
    icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Kontrol Listesi",
    description: "İşaretlenebilir görev listesi",
    icon: ListChecks,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Alıntı",
    description: "Vurgulu alıntı bloğu",
    icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Kod Bloğu",
    description: "Biçimlendirilmiş kod alanı",
    icon: Code,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Ayırıcı",
    description: "Yatay çizgi ile bölümü ayır",
    icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Tablo",
    description: "3x3 tablo ekle",
    icon: TableIcon,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Görsel",
    description: "URL ile görsel ekle",
    icon: ImageIcon,
    command: ({ editor, range }) => {
      const url = window.prompt("Görsel adresi (URL):");
      editor.chain().focus().deleteRange(range).run();
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
];

function getSlashCommandItems(query: string): SlashItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return ALL_ITEMS;
  return ALL_ITEMS.filter((item) => item.title.toLowerCase().includes(q));
}

const SlashCommandList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: SlashItem[]; command: (item: SlashItem) => void }
>(function SlashCommandList(props, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % props.items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = props.items[selected];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="w-64 rounded-xl border border-border bg-popover p-3 text-sm text-muted-foreground shadow-[var(--shadow-popover)]">
        Eşleşen komut yok
      </div>
    );
  }

  return (
    <div className="max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--shadow-popover)]">
      {props.items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => props.command(item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              index === selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

const suggestion: Omit<SuggestionOptions<SlashItem>, "editor"> = {
  char: "/",
  startOfLine: false,
  items: ({ query }) => getSlashCommandItems(query),
  render: () => {
    let component: ReactRenderer<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>;
    let element: HTMLElement | null = null;

    const position = (clientRect: (() => DOMRect | null) | null | undefined) => {
      if (!element || !clientRect) return;
      const rect = clientRect();
      if (!rect) return;
      element.style.position = "fixed";
      element.style.top = `${rect.bottom + 6}px`;
      element.style.left = `${rect.left}px`;
      element.style.zIndex = "60";
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props: { items: props.items, command: (item: SlashItem) => props.command(item) },
          editor: props.editor,
        });
        element = component.element as HTMLElement;
        document.body.appendChild(element);
        position(props.clientRect);
      },
      onUpdate: (props) => {
        component.updateProps({ items: props.items, command: (item: SlashItem) => props.command(item) });
        position(props.clientRect);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          element?.remove();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        element?.remove();
        component.destroy();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return { suggestion };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...(this.options.suggestion as Omit<SuggestionOptions<SlashItem>, "editor">),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          props.command({ editor, range });
        },
      }),
    ];
  },
});
