"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./comment-editor.module.css";

/**
 * Görev #318: görev açıklaması artık zengin metin destekler (kalın/italik/
 * liste) — CommentEditor'ün (bkz. comment-editor.tsx) sadeleştirilmiş bir
 * versiyonu. Mention/emoji/resim desteği yok (açıklama alanı bunlara ihtiyaç
 * duymuyor); yalnızca temel biçimlendirme. Kontrollü bileşen DEĞİLDİR —
 * Tiptap kendi iç durumunu tutar, her değişiklikte `onChange` ile hem JSON
 * ağacı hem düz metin karşılığı dışarı bildirilir (task-modal.tsx bunları
 * kendi `descriptionJson`/`description` state'ine yazar, kayıt "Kaydet"
 * butonuna basılınca gerçekleşir — diğer form alanlarıyla aynı desen).
 */
function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Bug fix (kullanıcı talebi): "açıklama kısmına tıklayınca beyaz sayfa açıyor,
 * komple temizliyor, yazılanın üzerine editletmiyor" — descriptionJson alanı
 * eklenmeden ÖNCE oluşturulmuş görevlerde yalnızca düz metin `description`
 * doludur, `descriptionJson` NULL'dur. Düzenleme moduna geçerken editöre
 * `content={null}` verilirse Tiptap boş başlar ve kullanıcı var olan metnin
 * üzerine hiç göremeden yazmaya başlar — görünürde "temizlenmiş" gibi
 * durur. Bu yardımcı, JSON yoksa düz metni satır satır paragraf düğümlerine
 * çevirerek editörün var olan içerikle seed edilmesini sağlar.
 */
export function plainTextToDoc(text: string): object {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function DescriptionEditor({
  content,
  onChange,
  placeholder = "Görev açıklaması ekleyin — kalın, italik, madde listesi kullanılabilir",
  autoFocus = false,
}: {
  content: unknown | null;
  onChange: (payload: { json: unknown; text: string }) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    content: (content as object) ?? undefined,
    extensions: [StarterKit.configure({ heading: false }), Placeholder.configure({ placeholder })],
    editorProps: {
      attributes: { class: "description-editor-prosemirror" },
    },
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => {
      onChange({ json: editor.getJSON(), text: editor.getText() });
    },
  });

  if (!editor) return null;

  return (
    <div className={cn(styles.editorRoot, "rounded-md border border-input bg-background")}>
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarBtn
          title="Kalın"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="İtalik"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Madde listesi"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Numaralı liste"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} className="min-h-[4.5rem] px-3 py-2" />
    </div>
  );
}
