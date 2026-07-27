import TaskItem from "@tiptap/extension-task-item";

/**
 * Standart Tiptap TaskItem'i (kontrol listesi maddesi) iki ek öznitelikle
 * genişletir — §7 "doküman içi görev entegrasyonu, kontrol listesi
 * maddesi → görev, MEVCUT görev modülüne bağlanmalı" gereksinimi:
 *
 *  - `documentBlockId`: bu maddenin kararlı kimliği (bir kez üretilir,
 *    öğe silinip yeniden eklenmediği sürece değişmez).
 *  - `linkedTaskId`: bu maddeden oluşturulan Task'ın kimliği (yoksa null
 *    — henüz bir göreve dönüştürülmemiş normal bir kontrol listesi
 *    maddesidir).
 *
 * Senkronizasyon yönü (kullanıcıya açıkça bildirilmiştir): kutunun
 * işaretlenmesi → bağlı görev tamamlanır/yeniden açılır (canlı, Yjs
 * oturumu üzerinden — bkz. collaborative-editor.tsx). Ters yön (görev
 * Kanban panosunda tamamlandığında kutunun OTOMATİK işaretlenmesi),
 * canlı bir Yjs oturumu dışından belge mutasyonu gerektirdiği için bu
 * sürümde uygulanmadı; bunun yerine madde üzerine gelindiğinde (title
 * özniteliği) bağlı görevin güncel durumu gösterilir.
 */
export const LinkedTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      documentBlockId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-block-id"),
        renderHTML: (attrs) => (attrs.documentBlockId ? { "data-block-id": attrs.documentBlockId } : {}),
      },
      linkedTaskId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-linked-task-id"),
        renderHTML: (attrs) =>
          attrs.linkedTaskId
            ? { "data-linked-task-id": attrs.linkedTaskId, class: "ortak-alan-linked-task-item" }
            : {},
      },
    };
  },
});
