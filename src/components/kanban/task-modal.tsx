"use client";

import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Download,
  X,
  Repeat,
  Pin,
  CheckCircle2,
  Link2,
  FileText,
  PlayCircle,
  Plus,
  Tag as TagIcon,
  ListChecks,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/tags/tag-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CommentEditor } from "@/components/kanban/comment-editor";
import { CommentView } from "@/components/kanban/comment-view";
import { DescriptionEditor, plainTextToDoc } from "@/components/kanban/description-editor";
import { DescriptionView } from "@/components/kanban/description-view";
import { AssigneePicker } from "@/components/kanban/assignee-picker";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { getYoutubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube";
import { detectSocialPlatform, SOCIAL_PLATFORM_LABELS } from "@/lib/social-link";
import { SOCIAL_PLATFORM_ICONS, SOCIAL_PLATFORM_TONE } from "@/components/kanban/social-icons";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import type { ColumnItem, TeamMemberOption } from "@/components/kanban/types";

interface Comment {
  id: string;
  body: string;
  // Görevlendirme #200: zengin metin (Tiptap JSON) — NULL ise eski düz
  // metin `body` render edilir (bkz. comment-view.tsx).
  bodyJson: unknown | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface TagDetail {
  id: string;
  name: string;
  color: string | null;
}

interface Attachment {
  id: string;
  kind: "UPLOAD" | "LINK";
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  createdAt: string;
  uploadedById: string;
  uploadedBy: { id: string; name: string | null; email: string };
  // Görevlendirme #199: bu ek kartta küçük önizleme olarak gösterilsin mi.
  showOnCard: boolean;
}

interface AssigneeDetail {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface CreatorDetail {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  // Görev #318: zengin metin (Tiptap JSON) sürümü — NULL ise eski düz metin
  // görev (bkz. description-view.tsx).
  descriptionJson: unknown | null;
  columnId: string;
  priority: string;
  kind: "DATED" | "FIXED";
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignees: AssigneeDetail[];
  creator?: CreatorDetail | null;
  recurringTemplateId: string | null;
  subtasks: Subtask[];
  comments: Comment[];
  tags: TagDetail[];
  attachments: Attachment[];
}

export function TaskModal({
  open,
  onClose,
  onSaved,
  projectId,
  projectKind,
  taskId,
  members,
  columns,
  defaultColumnId,
  defaultScheduledDate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projectId: string;
  projectKind: "DATED" | "FIXED";
  taskId: string | null;
  members: TeamMemberOption[];
  columns: ColumnItem[];
  defaultColumnId: string;
  defaultScheduledDate: string;
}) {
  const isEdit = !!taskId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Görev #318: zengin metin (Tiptap JSON) sürümü + okuma/düzenleme modu.
  // Açıklaması dolu bir görev okuma modunda açılır (bkz. kullanıcı talebi:
  // "okuma modunda açılsa sonra editleyebilse daha mantıklı"); boşsa veya
  // yeni görevse doğrudan düzenleme moduyla başlar.
  const [descriptionJson, setDescriptionJson] = useState<unknown | null>(null);
  const [editingDescription, setEditingDescription] = useState(true);
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [priority, setPriority] = useState("MEDIUM");
  const [kind, setKind] = useState<"DATED" | "FIXED">("DATED");
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate);
  const [dueDate, setDueDate] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<AssigneeDetail[]>([]);
  const [creator, setCreator] = useState<CreatorDetail | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [recurringTemplateId, setRecurringTemplateId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tags, setTags] = useState<TagDetail[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAttachment, setConfirmDeleteAttachment] = useState<string | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);
  const [stoppingRecurring, setStoppingRecurring] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  // Revizyon: "notlar çok aşağıya kayıyor" — Etiketler/Kontrol Listesi/
  // Ekler/Notlar artık sekmeli (tab) gösteriliyor, Notlar'a ulaşmak için
  // uzun bir kaydırma gerekmiyor, tek tıkla geçiliyor.
  const [activeTab, setActiveTab] = useState<"tags" | "checklist" | "attachments" | "notes">("checklist");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!taskId) {
      // Panel her açılışta yeniden kullanıldığından, "yeni görev" moduna
      // geçildiğinde formu önceki görevin verilerinden temizler.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setDescription("");
      setDescriptionJson(null);
      setEditingDescription(true);
      setColumnId(defaultColumnId);
      setPriority("MEDIUM");
      setKind("DATED");
      setScheduledDate(defaultScheduledDate);
      setDueDate("");
      setCompletedAt(null);
      setAssignees([]);
      setCreator(null);
      setRecurring(false);
      setRecurringTemplateId(null);
      setSubtasks([]);
      setComments([]);
      setTags([]);
      setAttachments([]);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((res) => res.json())
      .then((data) => {
        const task: TaskDetail = data.task;
        setTitle(task.title);
        setDescription(task.description ?? "");
        setDescriptionJson(task.descriptionJson ?? null);
        setEditingDescription(!task.description && !task.descriptionJson);
        setColumnId(task.columnId);
        // Revizyon: öncelik artık yalnızca "Normal Düzey"/"Acil Düzey" iki
        // seçenekle yönetiliyor — eski verilerde kalan LOW/HIGH değerleri
        // seçiciyle eşleşmediği için görünmez kalırdı, bu yüzden yüklenirken
        // en yakın karşılığa normalize edilir (yalnızca URGENT "Acil" sayılır).
        setPriority(task.priority === "URGENT" ? "URGENT" : "MEDIUM");
        setKind(task.kind);
        setScheduledDate(task.scheduledDate ? task.scheduledDate.slice(0, 10) : "");
        setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
        setCompletedAt(task.completedAt);
        setAssignees(task.assignees ?? []);
        setCreator(task.creator ?? null);
        setRecurringTemplateId(task.recurringTemplateId);
        setSubtasks(task.subtasks);
        setComments(task.comments);
        setTags(task.tags);
        setAttachments(task.attachments);
      })
      .finally(() => setLoading(false));
  }, [open, taskId, defaultColumnId, defaultScheduledDate]);

  // Kullanıcı talebi: Notlar, Etiketler, Liste (kontrol listesi) ve Ekler
  // sekmeleri F5 atmadan gelsin — panel açıkken diğer ekip üyelerinin
  // eklediği/sildiği/işaretlediği öğeler bu görevin verisini yeniden çekip
  // ilgili state'leri güncelleyerek yansıtılır. Başlık/açıklama gibi o an
  // düzenlenmekte olabilecek alanlar (ve `newSubtask` taslak metni) bu
  // tazelemeden etkilenmez — yalnızca sunucudan gelen liste alanları
  // (comments/tags/subtasks/attachments) baştan yazılır.
  useLiveRefresh(
    () => {
      if (!taskId) return;
      fetch(`/api/tasks/${taskId}`)
        .then((res) => res.json())
        .then((data) => {
          const task: TaskDetail | undefined = data.task;
          if (!task) return;
          setComments(task.comments);
          setTags(task.tags);
          setSubtasks(task.subtasks);
          setAttachments(task.attachments);
        })
        .catch(() => {});
    },
    5000,
    open && !!taskId,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!isEdit && recurring) {
      // Kullanıcı talebi #11: şablonlar artık normal görevler gibi birden
      // fazla kişi etiketlenebilir (bkz. RecurringTemplateAssignee).
      const res = await fetch(`/api/projects/${projectId}/recurring-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId,
          title,
          description: description || null,
          priority,
          assigneeIds: assignees.map((a) => a.id),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Tekrarlayan görev oluşturulamadı.");
        return;
      }
      onSaved();
      onClose();
      return;
    }

    const payload = {
      title,
      description: description || null,
      descriptionJson: descriptionJson ?? null,
      columnId,
      priority,
      ...(projectKind === "FIXED" ? {} : { scheduledDate }),
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      assigneeIds: assignees.map((a) => a.id),
    };

    const res = await fetch(
      isEdit ? `/api/tasks/${taskId}` : `/api/projects/${projectId}/tasks`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Görev kaydedilemedi.");
      return;
    }

    onSaved();
    onClose();
  }

  // `titleOverride` verilirse (bkz. addChecklistTemplate) input alanındaki
  // `newSubtask` state'ine dokunulmaz — toplu şablon eklemede kullanıcının
  // o an yazmakta olduğu metin kaybolmasın diye.
  async function addSubtask(titleOverride?: string) {
    const title = (titleOverride ?? newSubtask).trim();
    if (!title || !taskId) return;
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const { subtask } = await res.json();
      setSubtasks((s) => [...s, subtask]);
      if (titleOverride === undefined) setNewSubtask("");
      // Görevlendirme #202: panel içi aksiyonlar panoya F5 beklemeden yansır.
      onSaved();
    }
  }

  /**
   * İş geliştirme fikir değerlendirme şablonu — Projelendirme panosunu aynı
   * anda bir fikir/öneri takip aracı olarak da kullanabilmek için (bkz.
   * kullanıcı talebi). Zaten eklenmiş aynı başlıklı öğeler tekrar eklenmez.
   */
  const IDEA_CHECKLIST_TEMPLATE = [
    "Fikri tanımla",
    "Hedef/ihtiyaç analizi yap",
    "Fizibilite ve kaynak değerlendirmesi",
    "Önceliklendir (etki x efor)",
    "Karar: onay/red",
    "Uygulama planı oluştur",
  ];

  async function addChecklistTemplate() {
    for (const title of IDEA_CHECKLIST_TEMPLATE) {
      if (subtasks.some((s) => s.title === title)) continue;
      await addSubtask(title);
    }
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    setSubtasks((s) => s.map((st) => (st.id === subtaskId ? { ...st, done } : st)));
    await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    onSaved();
  }

  // Revizyon: "kontrol listesine hatalı girebilir" isteği — her satırın
  // yanına silme butonu.
  async function deleteSubtask(subtaskId: string) {
    if (!taskId) return;
    setSubtasks((s) => s.filter((st) => st.id !== subtaskId));
    await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
    onSaved();
  }

  // Görevlendirme #200: zengin metin editörü (CommentEditor) doğrudan
  // Tiptap JSON'ı + düz metin karşılığını + etiketlenen kişi kimliklerini
  // üretir; eski basit metin girişindeki gibi ayrıca bir "newComment" state
  // tutmaya gerek kalmadı.
  async function addComment(payload: { body: string; bodyJson: unknown; mentionedUserIds: string[] }) {
    if (!taskId) return;
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments((c) => [...c, comment]);
      onSaved();
    }
  }

  // Kullanıcı talebi: "Notlar kısmında kutucuk yanına tik koyulmuyor" —
  // salt-okunur not render'ındaki kontrol listesi kutucuğu tıklanınca
  // güncel bodyJson'ı sunucuya kaydeder ki F5'te kaybolmasın.
  async function toggleCommentChecklist(commentId: string, updatedBodyJson: unknown) {
    if (!taskId) return;
    setComments((c) => c.map((cm) => (cm.id === commentId ? { ...cm, bodyJson: updatedBodyJson } : cm)));
    await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyJson: updatedBodyJson }),
    });
  }

  // Revizyon: "notlar kısmına hatalı olabilir diye silme tuşu" isteği.
  async function deleteComment(commentId: string) {
    if (!taskId) return;
    setComments((c) => c.filter((cm) => cm.id !== commentId));
    await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
    onSaved();
  }

  async function attachTag(tagId: string) {
    if (!taskId) return;
    const res = await fetch(`/api/tasks/${taskId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (res.ok) {
      const res2 = await fetch(`/api/tasks/${taskId}`);
      const data = await res2.json();
      setTags(data.task.tags);
      onSaved();
    }
  }

  async function detachTag(tagId: string) {
    if (!taskId) return;
    setTags((t) => t.filter((tag) => tag.id !== tagId));
    await fetch(`/api/tasks/${taskId}/tags/${tagId}`, { method: "DELETE" });
    onSaved();
  }

  async function uploadAttachment(file: File) {
    if (!taskId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (res.ok) {
      const { attachment } = await res.json();
      setAttachments((a) => [...a, attachment]);
      onSaved();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Dosya yüklenemedi.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteAttachment(attachmentId: string) {
    if (!taskId) return;
    setAttachments((a) => a.filter((att) => att.id !== attachmentId));
    await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
    setConfirmDeleteAttachment(null);
    onSaved();
  }

  async function addLinkAttachment() {
    if (!linkUrl.trim() || !taskId) return;
    setLinkSaving(true);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim() || null }),
    });
    setLinkSaving(false);
    if (res.ok) {
      const { attachment } = await res.json();
      setAttachments((a) => [...a, attachment]);
      setLinkUrl("");
      setLinkTitle("");
      setAddingLink(false);
      onSaved();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Bağlantı eklenemedi.");
    }
  }

  // Görevlendirme #199, revizyon #327: bir eki görev kartının KAPAK (banner)
  // görseli yapar/kaldırır. Kullanıcı talebiyle netleşti: bu artık TEK
  // seçimli (radio) bir alan — biri kapak seçilince diğerleri otomatik
  // kaldırılır (sunucu tarafı da AYNI kuralı transaction ile garanti eder,
  // bkz. attachments/[attachmentId]/route.ts). Diğer TÜM ekler (kapak
  // olsun olmasın) zaten kartta otomatik ikon rozeti olarak görünür.
  async function toggleAttachmentShowOnCard(attachmentId: string, showOnCard: boolean) {
    if (!taskId) return;
    setAttachments((a) =>
      a.map((att) => {
        if (att.id === attachmentId) return { ...att, showOnCard };
        return showOnCard ? { ...att, showOnCard: false } : att;
      }),
    );
    await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnCard }),
    });
    onSaved();
  }

  async function deleteTask() {
    if (!taskId) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setConfirmDeleteTask(false);
    onSaved();
    onClose();
  }

  async function stopRecurring() {
    if (!recurringTemplateId) return;
    setStoppingRecurring(true);
    await fetch(`/api/projects/${projectId}/recurring-templates/${recurringTemplateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    setStoppingRecurring(false);
    setRecurringTemplateId(null);
  }

  return (
    <SidePanel open={open} onClose={onClose} title={isEdit ? "Görevi Düzenle" : "Yeni Görev"}>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <div className="space-y-5">
          {recurringTemplateId && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                Bu görev &ldquo;her gün tekrarla&rdquo; şablonundan otomatik türedi.
              </span>
              <button
                type="button"
                onClick={stopRecurring}
                disabled={stoppingRecurring}
                className="shrink-0 rounded px-1.5 py-0.5 font-medium underline-offset-2 hover:underline disabled:opacity-50"
              >
                {stoppingRecurring ? "Durduruluyor..." : "Tekrarı Durdur"}
              </button>
            </div>
          )}

          {isEdit && kind === "FIXED" && projectKind === "DATED" && (
            <div className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <Pin className="h-3.5 w-3.5" />
              Sabit görev — hangi gün seçilirse seçilsin panoda görünür.
            </div>
          )}

          {isEdit && completedAt && (
            <div className="flex items-center gap-1.5 rounded-md bg-tint-green px-3 py-2 text-xs text-tint-green-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tamamlandı:{" "}
              {new Date(completedAt).toLocaleString("tr-TR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Istanbul",
              })}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Başlık</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              {editingDescription ? (
                <DescriptionEditor
                  key={taskId ?? "new"}
                  // Bug fix: descriptionJson yoksa (görev bu özellikten önce
                  // oluşturulmuş) ama düz metin description doluysa, editör
                  // boş açılıp mevcut metni "silmiş" gibi görünmesin diye
                  // düz metin paragraflara çevrilip seed edilir.
                  content={descriptionJson ?? (description ? plainTextToDoc(description) : null)}
                  autoFocus={isEdit}
                  onChange={({ json, text }) => {
                    setDescriptionJson(json);
                    setDescription(text);
                  }}
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingDescription(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setEditingDescription(true);
                  }}
                  title="Düzenlemek için tıklayın"
                  className="group relative cursor-text rounded-md border border-transparent transition-colors hover:border-input hover:bg-accent/40"
                >
                  {/* Revizyon: uzun açıklamalar tüm paneli aşağı itip scroll'u
                      bozuyordu ("bütün ui/ux bozdu") — artık varsayılan olarak
                      kısa bir kutuda gösterilir, üzerine gelince kendi içinde
                      scroll edilebilen daha uzun bir kutuya genişler; panelin
                      geri kalanı yerinden oynamaz. */}
                  <div className="max-h-16 overflow-hidden px-3 py-2 transition-[max-height] duration-200 ease-out group-hover:max-h-64 group-hover:overflow-y-auto">
                    <DescriptionView description={description} descriptionJson={descriptionJson} />
                  </div>
                  {Boolean(description || descriptionJson) && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-md bg-gradient-to-t from-card to-transparent opacity-100 transition-opacity duration-150 group-hover:opacity-0" />
                  )}
                </div>
              )}
            </div>

            {!isEdit && projectKind === "DATED" && (
              <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                Her gün tekrarla — her gün otomatik olarak bu sütuna yeni bir görev eklensin
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sütun</Label>
                <SimpleSelect
                  value={columnId}
                  onValueChange={setColumnId}
                  options={columns.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Öncelik</Label>
                <SimpleSelect
                  value={priority}
                  onValueChange={setPriority}
                  options={[
                    { value: "MEDIUM", label: "Normal Düzey" },
                    { value: "URGENT", label: "Acil Düzey" },
                  ]}
                />
              </div>
              {!recurring && projectKind === "DATED" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Planlanan Tarih</Label>
                  <DatePicker value={scheduledDate} onChange={setScheduledDate} />
                </div>
              )}
              {!recurring && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Son Tarih</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Atananlar</Label>
              <AssigneePicker
                selected={assignees}
                members={members}
                onChange={(ids) => {
                  setAssignees(
                    ids
                      .map((id) => {
                        const existing = assignees.find((a) => a.id === id);
                        if (existing) return existing;
                        const m = members.find((mm) => mm.id === id);
                        return m ? { id: m.id, name: m.name, email: m.email, image: m.image ?? null } : null;
                      })
                      .filter((a): a is AssigneeDetail => a !== null),
                  );
                }}
              />
              {creator && (
                <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                  <Avatar name={creator.name} email={creator.email} image={creator.image} size={16} />
                  Oluşturan: {creator.name || creator.email}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              {isEdit ? (
                <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteTask(true)}>
                  Görevi Sil
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
                </Button>
              </div>
            </div>
          </form>

          {isEdit && (
            <div className="border-t border-border pt-4">
              {/* Revizyon: "notlar çok aşağıya kayıyor" — dört alt bölüm
                  artık sekmeli; hangisi seçilirse seçilsin tek tıkla
                  ulaşılıyor, uzun bir kaydırma gerekmiyor. */}
              <div className="flex gap-1 rounded-lg bg-secondary/40 p-1">
                {(
                  [
                    { key: "tags" as const, label: "Etiketler", icon: TagIcon, count: tags.length },
                    { key: "checklist" as const, label: "Liste", icon: ListChecks, count: subtasks.length },
                    { key: "attachments" as const, label: "Ekler", icon: Paperclip, count: attachments.length },
                    { key: "notes" as const, label: "Notlar", icon: MessageSquare, count: comments.length },
                  ]
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      activeTab === t.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                    {t.count > 0 && <span className="text-[10px] text-muted-foreground">({t.count})</span>}
                  </button>
                ))}
              </div>

              {activeTab === "tags" && (
                <div className="mt-3">
                  <TagPicker selected={tags} onAttach={attachTag} onDetach={detachTag} />
                </div>
              )}

              {activeTab === "checklist" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {subtasks.filter((s) => s.done).length}/{subtasks.length} tamamlandı
                    </p>
                    <button
                      type="button"
                      onClick={addChecklistTemplate}
                      className="text-xs text-primary underline-offset-2 hover:underline"
                    >
                      + İş geliştirme şablonu ekle
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {subtasks.map((s) => (
                      <div key={s.id} className="group flex items-center gap-2 text-sm text-foreground/90">
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={s.done}
                            onChange={(e) => toggleSubtask(s.id, e.target.checked)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className={s.done ? "text-muted-foreground line-through" : ""}>
                            {s.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => deleteSubtask(s.id)}
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label={`"${s.title}" öğesini sil`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <p className="text-sm text-muted-foreground">Henüz kontrol listesi öğesi yok.</p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Kontrol listesine ekle"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSubtask();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={() => addSubtask()}>
                      Ekle
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "attachments" && (
                <div className="mt-3">
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const detectedPlatform = att.kind === "LINK" && att.externalUrl ? detectSocialPlatform(att.externalUrl) : null;
                    // Kullanıcı bağlantı eklerken başlık girmediyse fileName
                    // ham URL olur (bkz. attachments/route.ts) — bu durumda
                    // uzun/çirkin URL yerine platform adını göster.
                    const displayName =
                      detectedPlatform && att.fileName === att.externalUrl
                        ? `${SOCIAL_PLATFORM_LABELS[detectedPlatform]} bağlantısı`
                        : att.fileName || att.externalUrl || "İsimsiz";
                    const isImage = att.kind === "UPLOAD" && (att.mimeType || "").startsWith("image/");
                    const isPdf = att.kind === "UPLOAD" && att.mimeType === "application/pdf";
                    const youtubeId = att.kind === "LINK" && att.externalUrl ? getYoutubeVideoId(att.externalUrl) : null;
                    // Görev #319: YouTube dışında Instagram/TikTok/LinkedIn/
                    // Facebook/X bağlantıları için marka renkli ikon+etiket
                    // önizleme kartı (canlı oEmbed/thumbnail yerine — bkz.
                    // social-link.ts üstündeki karar notu: her zaman çalışan,
                    // API anahtarı gerektirmeyen sabit önizleme).
                    const socialPlatform = !youtubeId ? detectedPlatform : null;
                    const SocialIcon = socialPlatform ? SOCIAL_PLATFORM_ICONS[socialPlatform] : null;
                    const previewHref =
                      att.kind === "LINK"
                        ? att.externalUrl ?? "#"
                        : `/api/tasks/${taskId}/attachments/${att.id}/download?inline=1`;

                    return (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm"
                      >
                        <a
                          href={previewHref}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          {isImage ? (
                            <img
                              src={`/api/tasks/${taskId}/attachments/${att.id}/download?inline=1`}
                              alt={displayName}
                              className="h-11 w-11 shrink-0 rounded-md object-cover"
                            />
                          ) : youtubeId ? (
                            <span className="relative shrink-0">
                              <img
                                src={youtubeThumbnailUrl(youtubeId)}
                                alt={displayName}
                                className="h-11 w-16 rounded-md object-cover"
                              />
                              <PlayCircle className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
                            </span>
                          ) : SocialIcon && socialPlatform ? (
                            <span
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-md",
                                SOCIAL_PLATFORM_TONE[socialPlatform],
                              )}
                            >
                              <SocialIcon className="h-5 w-5" />
                            </span>
                          ) : isPdf ? (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-tint-red text-tint-red-foreground">
                              <FileText className="h-5 w-5" />
                            </span>
                          ) : att.kind === "LINK" ? (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                              <Link2 className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                              <Paperclip className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-medium text-foreground/90 hover:underline">{displayName}</p>
                              {/* Kullanıcı talebi: "eklendiyse ben bilmiyorum neler eklendi" —
                                  özel başlık girilmiş olsa bile hangi platformdan geldiği her zaman
                                  ayrı bir küçük etiketle net görünür. */}
                              {socialPlatform && (
                                <span
                                  className={cn(
                                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                                    SOCIAL_PLATFORM_TONE[socialPlatform],
                                  )}
                                >
                                  {SOCIAL_PLATFORM_LABELS[socialPlatform]}
                                </span>
                              )}
                              {youtubeId && (
                                <span className="shrink-0 rounded bg-tint-red px-1.5 py-0.5 text-[10px] font-semibold leading-none text-tint-red-foreground">
                                  YouTube
                                </span>
                              )}
                              {isPdf && (
                                <span className="shrink-0 rounded bg-tint-red px-1.5 py-0.5 text-[10px] font-semibold leading-none text-tint-red-foreground">
                                  PDF
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {att.kind === "UPLOAD" && att.fileSize != null ? `${formatFileSize(att.fileSize)} · ` : ""}
                              {att.uploadedBy.name || att.uploadedBy.email} · {formatDate(att.createdAt)}
                            </p>
                          </div>
                        </a>
                        <div className="flex w-full shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-2 sm:w-auto sm:border-t-0 sm:pt-0">
                          {/* Revizyon #327: "kartta göster" artık yalnızca kartın
                              büyük KAPAK görselini seçer — bu yüzden yalnızca
                              resim/YouTube eklerinde görünür ve tek seçimlidir
                              (biri seçilince diğeri otomatik kaldırılır). Diğer
                              tüm ek türleri (Instagram/TikTok/PDF/vb.) zaten
                              işaretlemeye gerek kalmadan kartta otomatik ikon
                              rozeti olarak görünür. */}
                          {(isImage || youtubeId) && (
                            <label
                              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-background/60"
                              title="Bu görseli/videoyu görev kartının kapak resmi yap (yalnızca bir tanesi seçilebilir)"
                            >
                              <input
                                type="checkbox"
                                checked={att.showOnCard}
                                onChange={(e) => toggleAttachmentShowOnCard(att.id, e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-input accent-primary"
                              />
                              Kapak yap
                            </label>
                          )}
                          {att.kind === "UPLOAD" && (
                            <a
                              href={`/api/tasks/${taskId}/attachments/${att.id}/download`}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                              aria-label={`${displayName} dosyasını indir`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAttachment(att.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-background/60 hover:text-destructive"
                            aria-label={`${displayName} ekini sil`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {attachments.length === 0 && (
                    <p className="text-sm text-muted-foreground">Henüz ek yok.</p>
                  )}
                </div>

                {addingLink && (
                  <div className="mt-2 space-y-1.5 rounded-md border border-dashed border-border p-2">
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://youtube.com, instagram.com, tiktok.com, linkedin.com, facebook.com, x.com... veya herhangi bir bağlantı"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Başlık (opsiyonel)"
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLinkAttachment();
                        }
                      }}
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setAddingLink(false)}>
                        Vazgeç
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!linkUrl.trim() || linkSaving}
                        onClick={addLinkAttachment}
                      >
                        {linkSaving ? "Ekleniyor..." : "Ekle"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,*/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAttachment(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {uploading ? "Yükleniyor..." : "Dosya Ekle (resim/PDF)"}
                  </Button>
                  {!addingLink && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setAddingLink(true)}>
                      <Link2 className="h-3.5 w-3.5" />
                      Bağlantı Ekle
                    </Button>
                  )}
                </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="mt-3">
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {comments.map((c) => (
                      <div key={c.id} className="group relative rounded-md bg-secondary/50 px-3 py-2 pr-8 text-sm">
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label="Notu sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <CommentView
                          body={c.body}
                          bodyJson={c.bodyJson}
                          onToggleChecklist={(updated) => toggleCommentChecklist(c.id, updated)}
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.user.name || c.user.email} · {formatDate(c.createdAt)}
                        </p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground">Henüz not yok.</p>
                    )}
                  </div>
                  <div className="mt-2">
                    {taskId && <CommentEditor taskId={taskId} members={members} onSubmit={addComment} />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteAttachment}
        onOpenChange={(open) => !open && setConfirmDeleteAttachment(null)}
        description="Bu dosyayı silmek istediğinize emin misiniz?"
        onConfirm={() => confirmDeleteAttachment && deleteAttachment(confirmDeleteAttachment)}
      />
      <ConfirmDialog
        open={confirmDeleteTask}
        onOpenChange={setConfirmDeleteTask}
        description="Bu görevi silmek istediğinize emin misiniz?"
        onConfirm={deleteTask}
      />
    </SidePanel>
  );
}
