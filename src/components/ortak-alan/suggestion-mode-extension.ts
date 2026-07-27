import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface PendingSuggestion {
  suggestionId: string;
  type: "INSERT" | "DELETE";
  text: string;
}

const INTERNAL_META = "suggestionModeInternal";
const pluginKey = new PluginKey("suggestionMode");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMode: {
      setSuggestionModeActive: (active: boolean) => ReturnType;
      acceptSuggestion: (suggestionId: string) => ReturnType;
      rejectSuggestion: (suggestionId: string) => ReturnType;
    };
  }
}

interface SuggestionModeOptions {
  currentUser: { id: string; name: string };
  /** Yeni bir öneri metaverisi yaratıldığında (INSERT/DELETE) çağrılır —
   * bu bileşen yalnızca editör içi işaretlemeyi yapar; kalıcı kayıt
   * (DocumentSuggestion satırı + bildirim) çağıran React bileşeninin
   * sorumluluğundadır (bkz. collaborative-editor.tsx). */
  onSuggestionCreated?: (suggestion: PendingSuggestion) => void;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * "Öneri Modu" — açıkken yazılan metin otomatik olarak `suggestionInsert`
 * ile işaretlenir (appendTransaction ile eklenen aralık tespit edilerek);
 * Backspace/Delete tuşları gerçek silme yapmak yerine seçili/silinecek
 * aralığı `suggestionDelete` ile işaretler (metin görünürde kalır, üstü
 * çizili gösterilir). Kabul/red işlemleri doğrudan bu belgeyi değiştirir
 * (accept: mark'ı kaldırıp kalıcı yapar ya da metni gerçekten siler;
 * reject: tam tersini yapar) — bkz. suggestion-marks.ts başındaki not.
 *
 * Bilinen sınır (kullanıcıya bildirilmiştir): kesme (cut), sürükle-bırak
 * ile silme veya bir seçimin üzerine doğrudan yazma gibi dolaylı silme
 * yolları öneri moduna yakalanmaz — kullanıcı önce metni seçip "Silmeyi
 * Öner" ile işaretlemeli, sonra yeni metni ayrıca eklemelidir.
 */
export const SuggestionMode = Extension.create<SuggestionModeOptions>({
  name: "suggestionMode",

  addOptions() {
    return {
      currentUser: { id: "", name: "" },
      onSuggestionCreated: undefined,
    };
  },

  addStorage() {
    return { active: false };
  },

  addCommands() {
    return {
      setSuggestionModeActive:
        (active: boolean) =>
        ({ editor }) => {
          editor.storage.suggestionMode.active = active;
          return true;
        },
      acceptSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          const ranges = findMarkRanges(state.doc, suggestionId);
          if (ranges.length === 0) return false;
          if (!dispatch) return true;

          const isDelete = ranges[0].type === "suggestionDelete";
          if (isDelete) {
            // Kabul: önerilen silme gerçekleşir — metin kalıcı olarak kaldırılır.
            // Sondan başa doğru sil (pozisyon kaymasını önlemek için).
            for (const r of [...ranges].sort((a, b) => b.from - a.from)) {
              tr.delete(r.from, r.to);
            }
          } else {
            // Kabul: önerilen ekleme kalıcı olur — sadece mark'ı kaldır.
            for (const r of ranges) {
              tr.removeMark(r.from, r.to, state.schema.marks.suggestionInsert);
            }
          }
          tr.setMeta(INTERNAL_META, true);
          dispatch(tr);
          return true;
        },
      rejectSuggestion:
        (suggestionId: string) =>
        ({ tr, state, dispatch }) => {
          const ranges = findMarkRanges(state.doc, suggestionId);
          if (ranges.length === 0) return false;
          if (!dispatch) return true;

          const isDelete = ranges[0].type === "suggestionDelete";
          if (isDelete) {
            // Red: silme önerisi geri çekilir — mark kaldırılır, metin kalır.
            for (const r of ranges) {
              tr.removeMark(r.from, r.to, state.schema.marks.suggestionDelete);
            }
          } else {
            // Red: eklenen metin geri alınır — gerçekten silinir.
            for (const r of [...ranges].sort((a, b) => b.from - a.from)) {
              tr.delete(r.from, r.to);
            }
          }
          tr.setMeta(INTERNAL_META, true);
          dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    const markDeletionRange = (from: number, to: number) => {
      if (from >= to) return false;
      const { state, view } = this.editor;
      const suggestionId = genId();
      const text = state.doc.textBetween(from, to, " ");
      const tr = state.tr.addMark(
        from,
        to,
        state.schema.marks.suggestionDelete.create({
          suggestionId,
          authorId: this.options.currentUser.id,
          authorName: this.options.currentUser.name,
        }),
      );
      tr.setMeta(INTERNAL_META, true);
      tr.setSelection(TextSelection.create(tr.doc, to));
      view.dispatch(tr);
      this.options.onSuggestionCreated?.({ suggestionId, type: "DELETE", text });
      return true;
    };

    return {
      Backspace: () => {
        if (!this.editor.storage.suggestionMode.active) return false;
        const { from, to, empty } = this.editor.state.selection;
        if (!empty) return markDeletionRange(from, to);
        if (from === 0) return false;
        return markDeletionRange(from - 1, from);
      },
      Delete: () => {
        if (!this.editor.storage.suggestionMode.active) return false;
        const { from, to, empty } = this.editor.state.selection;
        if (!empty) return markDeletionRange(from, to);
        const docSize = this.editor.state.doc.content.size;
        if (from >= docSize) return false;
        return markDeletionRange(from, from + 1);
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionStorage = this.storage;
    const options = this.options;

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, oldState, newState) => {
          if (!extensionStorage.active) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (transactions.some((tr) => tr.getMeta(INTERNAL_META))) return null;
          // Silme kısayolları (Backspace/Delete) zaten kendi işaretlemesini
          // yapıp INTERNAL_META bayrağıyla işaretliyor — burası yalnızca
          // NET metin artışı (ekleme) durumlarını yakalar.
          const oldSize = oldState.doc.content.size;
          const newSize = newState.doc.content.size;
          if (newSize <= oldSize) return null;

          const start = oldState.doc.content.findDiffStart(newState.doc.content);
          if (start == null) return null;
          const diffEnd = oldState.doc.content.findDiffEnd(newState.doc.content);
          if (!diffEnd) return null;
          const newEnd = diffEnd.b;
          if (newEnd <= start) return null;

          const suggestionId = genId();
          const tr = newState.tr.addMark(
            start,
            newEnd,
            newState.schema.marks.suggestionInsert.create({
              suggestionId,
              authorId: options.currentUser.id,
              authorName: options.currentUser.name,
            }),
          );
          tr.setMeta(INTERNAL_META, true);
          const text = newState.doc.textBetween(start, newEnd, " ");
          options.onSuggestionCreated?.({ suggestionId, type: "INSERT", text });
          return tr;
        },
      }),
    ];
  },
});

function findMarkRanges(doc: PMNode, suggestionId: string) {
  const ranges: { from: number; to: number; type: "suggestionInsert" | "suggestionDelete" }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (
        (mark.type.name === "suggestionInsert" || mark.type.name === "suggestionDelete") &&
        mark.attrs.suggestionId === suggestionId
      ) {
        ranges.push({ from: pos, to: pos + node.nodeSize, type: mark.type.name as "suggestionInsert" | "suggestionDelete" });
      }
    }
  });
  return ranges;
}
