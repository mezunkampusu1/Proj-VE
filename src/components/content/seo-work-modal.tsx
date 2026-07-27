"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AssigneePicker } from "@/components/kanban/assignee-picker";
import { TagInput } from "@/components/content/tag-input";
import { ContentViewSections, chipsF, linkF, paragraphF, textF } from "@/components/content/content-view-sections";
import { contentStatusLabel, contentStatusLabels, contentStatusTone, formatDate, seoWorkTypeLabel, seoWorkTypeLabels } from "@/lib/utils";
import type { ContentPermissionSet } from "@/lib/content-permissions";
import type { TeamMemberOption } from "@/components/kanban/types";

interface BrandOption {
  id: string;
  name: string;
}

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Düşük" },
  { value: "MEDIUM", label: "Orta" },
  { value: "HIGH", label: "Yüksek" },
  { value: "URGENT", label: "Acil" },
];

const WORK_TYPE_OPTIONS = Object.entries(seoWorkTypeLabels).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(contentStatusLabels).map(([value, label]) => ({ value, label }));

interface MentionedUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

interface SeoWorkDetail {
  id: string;
  createdById: string;
  brandId: string | null;
  workType: string;
  title: string;
  targetPage: string | null;
  targetUrl: string | null;
  description: string | null;
  findings: string | null;
  actionsTaken: string | null;
  keywords: string[];
  assignedToId: string | null;
  dueDate: string | null;
  priority: string;
  internalNotes: string | null;
  status: string;
  mentions: { user: MentionedUser }[];
}

/** SEO/GEO çalışması modalı — bloga bağlı olmayan bağımsız işler (bkz. proje talebi §8). */
export function SeoWorkModal({
  open,
  contentId,
  currentUserId,
  members,
  brands,
  permissions,
  isAdmin,
  onClose,
  onSaved,
}: {
  open: boolean;
  contentId: string | null;
  currentUserId: string;
  members: TeamMemberOption[];
  brands: BrandOption[];
  permissions: ContentPermissionSet;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contentId;

  const [brandId, setBrandId] = useState("");
  const [workType, setWorkType] = useState("KEYWORD_RESEARCH");
  const [title, setTitle] = useState("");
  const [targetPage, setTargetPage] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [description, setDescription] = useState("");
  const [findings, setFindings] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("IDEA");
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [createdById, setCreatedById] = useState<string | null>(null);

  // Kullanıcı talebi: kartı açmak doğrudan düzenleme formuna değil, önce
  // salt-okunur bir görüntüleme moduna götürsün.
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const canEditStatus = isEdit && (permissions.canEditAllContent || isAdmin);
  const canDelete =
    isEdit &&
    (isAdmin ||
      permissions.canDeleteAllContent ||
      (permissions.canDeleteOwnContent && createdById === currentUserId));

  useEffect(() => {
    if (!open) return;
    if (!contentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("edit");
      setBrandId("");
      setWorkType("KEYWORD_RESEARCH");
      setTitle("");
      setTargetPage("");
      setTargetUrl("");
      setDescription("");
      setFindings("");
      setActionsTaken("");
      setKeywords([]);
      setAssignedToId("");
      setDueDate("");
      setPriority("MEDIUM");
      setInternalNotes("");
      setStatus("IDEA");
      setMentionedUsers([]);
      setCreatedById(null);
      setError(null);
      return;
    }

    setLoading(true);
    setMode("view");
    fetch(`/api/content/seo/${contentId}`)
      .then((res) => res.json())
      .then((data) => {
        const c: SeoWorkDetail = data.content;
        setBrandId(c.brandId ?? "");
        setWorkType(c.workType);
        setTitle(c.title);
        setTargetPage(c.targetPage ?? "");
        setTargetUrl(c.targetUrl ?? "");
        setDescription(c.description ?? "");
        setFindings(c.findings ?? "");
        setActionsTaken(c.actionsTaken ?? "");
        setKeywords(c.keywords ?? []);
        setAssignedToId(c.assignedToId ?? "");
        setDueDate(c.dueDate ? c.dueDate.slice(0, 10) : "");
        setPriority(c.priority);
        setInternalNotes(c.internalNotes ?? "");
        setStatus(c.status);
        setMentionedUsers(c.mentions.map((m) => m.user));
        setCreatedById(c.createdById);
      })
      .finally(() => setLoading(false));
  }, [open, contentId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Lütfen başlık girin.");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      brandId: brandId || null,
      workType,
      title,
      targetPage: targetPage || null,
      targetUrl: targetUrl || "",
      description: description || null,
      findings: findings || null,
      actionsTaken: actionsTaken || null,
      keywords,
      assignedToId: assignedToId || null,
      dueDate: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
      priority,
      internalNotes: internalNotes || null,
      mentionedUserIds: mentionedUsers.map((u) => u.id),
    };
    if (isEdit && canEditStatus) payload.status = status;

    const res = await fetch(isEdit ? `/api/content/seo/${contentId}` : "/api/content/seo", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Kayıt kaydedilemedi.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteContent() {
    if (!contentId) return;
    await fetch(`/api/content/seo/${contentId}`, { method: "DELETE" });
    setConfirmDeleteOpen(false);
    onSaved();
    onClose();
  }

  function findMember(id: string) {
    return members.find((m) => m.id === id) ?? null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? (mode === "view" ? "SEO Çalışması" : "SEO Çalışmasını Düzenle") : "Yeni SEO Çalışması"}
      wide
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : mode === "view" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={contentStatusTone[status] ?? "slate"}>{contentStatusLabel(status)}</Badge>
              <Badge tone="slate">{seoWorkTypeLabel(workType)}</Badge>
              {priority === "URGENT" && <Badge tone="red">Acil</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {[brands.find((b) => b.id === brandId)?.name, dueDate ? `Termin: ${formatDate(dueDate)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <ContentViewSections
            sections={[
              {
                fields: [
                  { label: "Açıklama", data: paragraphF(description), fullWidth: true },
                  { label: "Bulgular", data: paragraphF(findings), fullWidth: true },
                  { label: "Yapılan İşlemler", data: paragraphF(actionsTaken), fullWidth: true },
                ],
              },
              {
                title: "Detaylar",
                fields: [
                  { label: "Hedef Sayfa", data: textF(targetPage) },
                  { label: "Hedef URL", data: linkF(targetUrl) },
                  { label: "Anahtar Kelimeler", data: chipsF(keywords), fullWidth: true },
                ],
              },
              { fields: [{ label: "Dahili Notlar", data: paragraphF(internalNotes), fullWidth: true }] },
            ]}
          />

          {assignedToId && (
            <div className="space-y-2">
              <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Atanan
              </h3>
              {(() => {
                const m = findMember(assignedToId);
                return (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Avatar name={m?.name ?? null} email={m?.email ?? ""} image={m?.image} size={22} />
                    <span>{m?.name || m?.email}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {mentionedUsers.length > 0 && (
            <div className="space-y-2">
              <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Etiketlenen Kişiler
              </h3>
              <div className="flex flex-wrap gap-2">
                {mentionedUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs">
                    <Avatar name={u.name} email={u.email} image={u.image} size={18} />
                    {u.name || u.email}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            {canDelete ? (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                Kaydı Sil
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Kapat
              </Button>
              <Button type="button" onClick={() => setMode("edit")}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Düzenle
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Çalışma Türü</Label>
              <SimpleSelect value={workType} onValueChange={setWorkType} options={WORK_TYPE_OPTIONS} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marka</Label>
              <SimpleSelect value={brandId} onValueChange={setBrandId} placeholder="Seçilmedi" options={brands.map((b) => ({ value: b.id, label: b.name }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Başlık</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hedef Sayfa</Label>
              <Input value={targetPage} onChange={(e) => setTargetPage(e.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hedef URL</Label>
              <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Açıklama</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bulgular</Label>
              <Textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Yapılan İşlemler</Label>
              <Textarea rows={3} value={actionsTaken} onChange={(e) => setActionsTaken(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Anahtar Kelimeler</Label>
            <TagInput value={keywords} onChange={setKeywords} placeholder="anahtar kelime ekle..." />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Termin Tarihi</Label>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Öncelik</Label>
              <SimpleSelect value={priority} onValueChange={setPriority} options={PRIORITY_OPTIONS} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Atanan Kişi</Label>
              <SimpleSelect value={assignedToId} onValueChange={setAssignedToId} placeholder="Atanmadı" options={members.map((m) => ({ value: m.id, label: m.name || m.email }))} />
            </div>
          </div>

          {canEditStatus && (
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Durum</Label>
              <SimpleSelect value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etiketlenen Kişiler</Label>
            <AssigneePicker selected={mentionedUsers} members={members} onChange={(ids) => setMentionedUsers(members.filter((m) => ids.includes(m.id)))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Dahili Notlar</Label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-1">
            {canDelete ? (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                Kaydı Sil
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        description="Bu SEO çalışmasını silmek istediğinize emin misiniz?"
        onConfirm={deleteContent}
      />
    </Modal>
  );
}
