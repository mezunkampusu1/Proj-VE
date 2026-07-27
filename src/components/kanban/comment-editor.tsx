"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, Italic, List, ListOrdered, ListChecks, Image as ImageIcon, Smile, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { createDocumentMentionExtension } from "@/components/ortak-alan/document-mention";
import { EmojiPicker } from "@/components/kanban/emoji-picker";
import type { TeamMemberOption } from "@/components/kanban/types";
import styles from "./comment-editor.module.css";

/**
 * Görevlendirme #200: Ortak Alan'daki tam araç çubuklu Tiptap editörünün
 * hafifletilmiş, işbirliksiz (Yjs'siz) bir versiyonu — görev notları için.
 * @mention altyapısı (document-mention.tsx) doğrudan paylaşılır; mention
 * düğümlerinin kimlikleri gönderim anında JSON ağacından çıkarılır ve
 * mentionedUserIds olarak API'ye ayrı bir alan olarak gönderilir (bkz.
 * schema.prisma / validations.ts yorumları — metne gömülü belirteç yerine
 * yapısal liste tercih edildi).
 */
function extractMentionedUserIds(node: unknown): string[] {
  const ids = new Set<string>();
  function walk(n: unknown) {
    if (!n || typeof n !== "object") return;
    const obj = n as { type?: string; attrs?: { id?: string }; content?: unknown[] };
    if (obj.type === "mention" && obj.attrs?.id) ids.add(obj.attrs.id);
    if (Array.isArray(obj.content)) obj.content.forEach(walk);
  }
  walk(node);
  return Array.from(ids);
}

function ToolbarBtn({
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
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function CommentEditor({
  taskId,
  members,
  onSubmit,
  placeholder = "Not düşün — kalın, liste, emoji ekleyin veya bir ekip arkadaşını @ ile etiketleyin",
}: {
  taskId: string;
  members: TeamMemberOption[];
  onSubmit: (payload: { body: string; bodyJson: unknown; mentionedUserIds: string[] }) => Promise<void> | void;
  placeholder?: string;
}) {
  const membersRef = useRef(members);
  membersRef.current = members;
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-md" } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      createDocumentMentionExtension(
        () => membersRef.current,
        () => {},
      ),
    ],
    editorProps: {
      attributes: { class: "comment-editor-prosemirror" },
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!editor || editor.isEmpty || submitting) return;
    setSubmitting(true);
    const json = editor.getJSON();
    const text = editor.getText();
    const mentionedUserIds = extractMentionedUserIds(json);
    try {
      await onSubmit({ body: text, bodyJson: json, mentionedUserIds });
      editor.commands.clearContent();
    } finally {
      setSubmitting(false);
    }
  }, [editor, onSubmit, submitting]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/comment-images`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } finally {
      setUploading(false);
    }
  };

  if (!editor) return null;

  return (
    <div className={cn(styles.editorRoot, "rounded-md border border-input bg-background")}>
      <EditorContent
        editor={editor}
        onKeyDown={(e: React.KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="max-h-40 min-h-[3rem] overflow-y-auto px-3 py-2"
      />
      <div className="flex items-center justify-between gap-1 border-t border-border px-1.5 py-1">
        <div className="flex items-center gap-0.5">
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
          <ToolbarBtn
            title="Kontrol listesi (kutucuk)"
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Görsel ekle" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn title="Emoji ekle" active={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
              <Smile className="h-3.5 w-3.5" />
            </ToolbarBtn>
            {emojiOpen && (
              <EmojiPicker
                onSelect={(emoji) => {
                  editor.chain().focus().insertContent(emoji).run();
                  setEmojiOpen(false);
                }}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={editor.isEmpty || submitting}
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
          {submitting ? "Gönderiliyor..." : "Gönder"}
        </button>
      </div>
    </div>
  );
}
