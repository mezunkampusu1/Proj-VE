"use client";

import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeamMemberOption } from "@/components/kanban/types";

/**
 * Doküman GÖVDESİ içinde `@` ile kullanıcı etiketleme (§11 — yorumlar/
 * görevlerdeki etiketlemeyle AYNI kişi listesi, ekip üyeleri). Yorum
 * panelindeki MentionInput'tan farklı olarak burada Tiptap'ın resmi
 * `@tiptap/extension-mention` + `@tiptap/suggestion` altyapısı kullanılır
 * çünkü hedef düz metin değil, Yjs ile senkronize bir ProseMirror
 * düğümüdür (diğer kullanıcılarda da aynı etiket olarak görünmesi için).
 *
 * Erişim uyarısı ve bildirim: bir kullanıcı seçildiği ANDA (mention
 * düğümü eklendiği anda), `onMentionInserted` callback'i çağrılır — bu,
 * collaborative-editor.tsx'te sunucuya bildirim isteği gönderir ve
 * hedef kullanıcının dokümana erişimi yoksa anında bir uyarı gösterir.
 */
export function createDocumentMentionExtension(
  getMembers: () => TeamMemberOption[],
  onMentionInserted: (userId: string, name: string) => void,
) {
  const suggestion: Omit<SuggestionOptions<TeamMemberOption>, "editor"> = {
    char: "@",
    items: ({ query }) => {
      const q = query.toLowerCase();
      return getMembers()
        .filter((m) => (m.name || m.email).toLowerCase().includes(q))
        .slice(0, 6);
    },
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
          component = new ReactRenderer(MentionList, {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          });
          element = component.element as HTMLElement;
          // data-mention-popup: bu öğe document.body'ye doğrudan eklendiği
          // için (Radix Dialog'un DialogContent DOM alt ağacının DIŞINDA),
          // Radix'in "dışarı tıklama" algılayıcısı buraya yapılan tıklamayı
          // modal DIŞI sayıp modalı anında kapatıyordu — bu yüzden görev
          // notlarında/dokümanlarda kişi etiketleme çalışmıyordu (kullanıcı
          // talebi #8: "notlar kısmında kişi etiketleyemiyorum, kesinlikle
          // fixle"). ui/dialog.tsx içindeki DialogContent artık bu
          // özniteliği taşıyan öğelere yapılan tıklamaları yok sayıyor.
          element.setAttribute("data-mention-popup", "");
          document.body.appendChild(element);
          position(props.clientRect);
        },
        onUpdate: (props) => {
          component.updateProps({ items: props.items, command: props.command });
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

  return Mention.configure({
    HTMLAttributes: { class: "ortak-alan-mention" },
    suggestion: {
      ...suggestion,
      command: ({ editor, range, props }) => {
        const member = props as unknown as TeamMemberOption;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: { id: member.id, label: member.name || member.email } },
            { type: "text", text: " " },
          ])
          .run();
        onMentionInserted(member.id, member.name || member.email);
      },
    },
  });
}

const MentionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: TeamMemberOption[]; command: (item: TeamMemberOption) => void }
>(function MentionList(props, ref) {
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
      <div className="w-56 rounded-xl border border-border bg-popover p-3 text-sm text-muted-foreground shadow-[var(--shadow-popover)]">
        Eşleşen kullanıcı yok
      </div>
    );
  }

  return (
    <div className="max-h-64 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--shadow-popover)]">
      {props.items.map((m, index) => (
        <button
          key={m.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => props.command(m)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
            index === selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
          )}
        >
          <Avatar name={m.name} email={m.email} size={20} />
          <span className="truncate">{m.name || m.email}</span>
        </button>
      ))}
    </div>
  );
});
