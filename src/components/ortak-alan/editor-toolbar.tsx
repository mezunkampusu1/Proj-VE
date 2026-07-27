"use client";

import type { Editor } from "@tiptap/react";
import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Link2,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Highlighter,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];
const TEXT_COLORS = ["#111827", "#dc2626", "#d97706", "#16a34a", "#2563eb", "#9333ea"];

/**
 * Editör araç çubuğu — spesifikasyondaki (§4) tüm biçimlendirme
 * seçeneklerini kapsar: başlıklar, kalın/italik/altı çizili/üstü çizili,
 * hizalama, madde/numara/kontrol listesi, alıntı, kod bloğu, ayırıcı,
 * bağlantı, tablo, görsel, metin rengi, vurgu (highlight), geri al/ileri al.
 * Salt-okunur (VIEWER/COMMENTER) erişimde gösterilmez — bkz.
 * collaborative-editor.tsx.
 */
export function EditorToolbar({ editor, documentId }: { editor: Editor; documentId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Bağlantı adresi:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImageByUrl = () => {
    const url = window.prompt("Görsel adresi (URL):");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Görev #190: görsel ekleme önceden yalnızca URL ile mümkündü.
  // Bilgisayardan seçilen dosya /api/documents/[documentId]/images'e
  // yüklenir, dönen URL editöre gömülür. Boyutlandırma editördeki görselin
  // kendi sürükleme tutamacıyla yapılır (bkz. resizable-image.tsx).
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/documents/${documentId}/images`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Görsel yüklenemedi.");
      editor.chain().focus().setImage({ src: data.url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görsel yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  // Görev #191: tablo ekleme önceden hep sabit 3x3 oluşturuyordu, boyut
  // sormuyordu. Küçük bir "kaç satır x kaç sütun" ızgara seçici eklendi —
  // üzerine gelinen hücreye göre boyut önizlenir, tıklanınca o boyutta
  // tablo eklenir.
  const [tableHover, setTableHover] = useState({ rows: 1, cols: 1 });
  const TABLE_PICKER_MAX = 6;

  const insertTableWithSize = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-card px-2 py-1.5">
      <ToolbarButton title="Geri al" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Yinele" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title="Başlık 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Başlık 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Başlık 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title="Kalın" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="İtalik" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Altı çizili" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Üstü çizili" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <div className="group relative">
        <ToolbarButton title="Metin rengi" onClick={() => {}}>
          <Palette className="h-4 w-4" />
        </ToolbarButton>
        <div className="absolute left-0 top-full z-20 hidden gap-1 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--shadow-popover)] group-hover:flex group-focus-within:flex">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(color).run()}
              className="h-5 w-5 rounded-full ring-1 ring-border"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="group relative">
        <ToolbarButton title="Vurgu" active={editor.isActive("highlight")} onClick={() => {}}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <div className="absolute left-0 top-full z-20 hidden gap-1 rounded-lg border border-border bg-popover p-1.5 shadow-[var(--shadow-popover)] group-hover:flex group-focus-within:flex">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
              className="h-5 w-5 rounded-full ring-1 ring-border"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title="Sola hizala" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Ortala" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Sağa hizala" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title="Madde işaretli liste" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Numaralı liste" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Kontrol listesi" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title="Alıntı" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Kod bloğu" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Ayırıcı" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Bağlantı" active={editor.isActive("link")} onClick={addLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleImageFileSelected}
      />
      <div className="group relative">
        <ToolbarButton title="Görsel ekle" disabled={uploading} onClick={() => {}}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="absolute left-0 top-full z-20 hidden w-44 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-[var(--shadow-popover)] group-hover:flex group-focus-within:flex">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={triggerImageUpload}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground/90 hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Yükleniyor…" : "Bilgisayardan Yükle"}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addImageByUrl}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground/90 hover:bg-accent"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Bağlantı ile Ekle
          </button>
        </div>
      </div>
      <div className="group relative">
        <ToolbarButton title="Tablo ekle" onClick={() => {}}>
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="absolute left-0 top-full z-20 hidden flex-col gap-1.5 rounded-lg border border-border bg-popover p-2 shadow-[var(--shadow-popover)] group-hover:flex group-focus-within:flex">
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${TABLE_PICKER_MAX}, 1rem)` }}
            onMouseLeave={() => setTableHover({ rows: 1, cols: 1 })}
          >
            {Array.from({ length: TABLE_PICKER_MAX * TABLE_PICKER_MAX }).map((_, i) => {
              const row = Math.floor(i / TABLE_PICKER_MAX) + 1;
              const col = (i % TABLE_PICKER_MAX) + 1;
              const active = row <= tableHover.rows && col <= tableHover.cols;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setTableHover({ rows: row, cols: col })}
                  onClick={() => insertTableWithSize(row, col)}
                  className={cn("h-4 w-4 rounded-sm border", active ? "border-primary bg-primary/30" : "border-border")}
                />
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {tableHover.rows} x {tableHover.cols}
          </p>
        </div>
      </div>
    </div>
  );
}
