import { Mark, mergeAttributes } from "@tiptap/core";

export interface SuggestionMarkAttrs {
  suggestionId: string;
  authorId: string;
  authorName: string;
}

const sharedAttributes = {
  suggestionId: { default: null },
  authorId: { default: null },
  authorName: { default: "" },
};

/**
 * Öneri modu (track-changes) işaretleri — spesifikasyon §6.
 *
 * Basitleştirme notu (kullanıcıya açıkça bildirilmiştir): INSERT ve DELETE
 * önerileri bu iki Tiptap mark'ı ile TAM işlevsel olarak uygulanır (metin
 * gerçekten silinmez, yalnızca üstü çizili olarak işaretlenir; kabul/red
 * doğrudan Yjs belgesini değiştirir). FORMAT ve MOVE önerileri ise yalnızca
 * `DocumentSuggestion` tablosunda açıklama metni olarak tutulur ve
 * kabul/red yalnızca durumu günceller — biçim/taşıma değişikliğini
 * otomatik uygulamaz (kabul eden kişi değişikliği kendisi manuel yapar).
 * Bu, tam bir "format diff" motoru kurmadan zaman içinde genişletilebilir,
 * dürüst bir kapsam kararıdır.
 */
export const SuggestionInsert = Mark.create<Record<string, never>, SuggestionMarkAttrs>({
  name: "suggestionInsert",
  excludes: "",
  inclusive: false,
  addAttributes() {
    return sharedAttributes;
  },
  parseHTML() {
    return [{ tag: "ins[data-suggestion-insert]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "ins",
      mergeAttributes(HTMLAttributes, {
        "data-suggestion-insert": "",
        class: "ortak-alan-suggestion-insert",
        title: `Öneri: ekleme (${HTMLAttributes.authorName || ""})`,
      }),
      0,
    ];
  },
});

export const SuggestionDelete = Mark.create<Record<string, never>, SuggestionMarkAttrs>({
  name: "suggestionDelete",
  excludes: "",
  inclusive: false,
  addAttributes() {
    return sharedAttributes;
  },
  parseHTML() {
    return [{ tag: "del[data-suggestion-delete]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "del",
      mergeAttributes(HTMLAttributes, {
        "data-suggestion-delete": "",
        class: "ortak-alan-suggestion-delete",
        title: `Öneri: silme (${HTMLAttributes.authorName || ""})`,
      }),
      0,
    ];
  },
});
