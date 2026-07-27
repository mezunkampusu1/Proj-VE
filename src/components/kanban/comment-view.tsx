"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Mention from "@tiptap/extension-mention";
import { cn } from "@/lib/utils";
import { MentionText } from "@/components/kanban/mention-input";
import styles from "./comment-editor.module.css";

/**
 * Görevlendirme #200: zengin metin notların salt-okunur render'ı.
 * `bodyJson` doluysa (yeni zengin format) aynı düğüm şeması içinde
 * salt-okunur bir Tiptap örneğiyle gösterilir. Kutucuklar (task list)
 * `onReadOnlyChecked` ile tıklanabilir hale getirilmiştir (bkz. kullanıcı
 * talebi: "Notlar kısmında kutucuk yanına tik koyulmuyor" — önceden
 * tamamen salt-okunurdu, tıklama görsel bir etki bile yaratmıyordu ve
 * hiçbir zaman sunucuya kaydedilmiyordu). Eski yorumlarda `bodyJson`
 * NULL'dur; bu durumda önceki düz metin + @mention ayrıştırıcısı
 * (MentionText) kullanılmaya devam eder — o formatta checklist yoktur.
 */
export function CommentView({
  body,
  bodyJson,
  onToggleChecklist,
}: {
  body: string;
  bodyJson: unknown | null;
  /** Bir kutucuk işaretlendiğinde/kaldırıldığında güncel bodyJson'ı sunucuya kaydetmesi için çağrılır. */
  onToggleChecklist?: (updatedBodyJson: unknown) => void;
}) {
  if (!bodyJson) {
    return <MentionText body={body} className="text-foreground/90" />;
  }

  return <RichCommentView content={bodyJson} onToggleChecklist={onToggleChecklist} />;
}

function RichCommentView({
  content,
  onToggleChecklist,
}: {
  content: unknown;
  onToggleChecklist?: (updatedBodyJson: unknown) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content: content as object,
    extensions: [
      StarterKit.configure({ heading: false }),
      Image.configure({ inline: false }),
      TaskList,
      TaskItem.configure({
        nested: true,
        // Salt-okunur editörde bile kutucuk tıklamasına izin ver — bu,
        // Tiptap'in bilinçli tasarlanmış "readonly checkbox" deseni:
        // editör genel olarak düzenlenemez ama bu callback true dönerse
        // yalnızca `checked` niteliği güncellenir (bkz. Tiptap dokümanı).
        onReadOnlyChecked: (node, checked) => {
          if (!onToggleChecklist) return false;
          // Tiptap dahili olarak node.attrs.checked'i günceller; bir
          // sonraki mikro-görevde editörün güncel JSON'unu okuyup
          // dışarı bildiriyoruz ki sunucuya kaydedilsin.
          setTimeout(() => {
            onToggleChecklist(editor?.getJSON());
          }, 0);
          return true;
        },
      }),
      Mention.configure({ HTMLAttributes: { class: "ortak-alan-mention" } }),
    ],
  });

  if (!editor) return null;

  return (
    <div className={cn(styles.editorRoot, "text-foreground/90")}>
      <EditorContent editor={editor} />
    </div>
  );
}
