"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import styles from "./comment-editor.module.css";

/**
 * Görev #318: görev açıklamasının salt-okunur (okuma modu) render'ı —
 * comment-view.tsx'teki desenle birebir aynı. `descriptionJson` doluysa
 * zengin biçimlendirilmiş içerik Tiptap ile render edilir; NULL ise (eski
 * görev ya da hiç düzenlenmemiş) düz metin `description` gösterilir.
 */
export function DescriptionView({
  description,
  descriptionJson,
}: {
  description: string | null;
  descriptionJson: unknown | null;
}): React.JSX.Element {
  if (!descriptionJson) {
    return <p className="whitespace-pre-wrap text-sm text-foreground/90">{description}</p>;
  }

  return <RichDescriptionView content={descriptionJson} />;
}

function RichDescriptionView({ content }: { content: unknown }): React.JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content: content as object,
    extensions: [StarterKit.configure({ heading: false })],
  });

  if (!editor) return <></>;

  return (
    <div className={cn(styles.editorRoot, "text-sm text-foreground/90")}>
      <EditorContent editor={editor} />
    </div>
  );
}
