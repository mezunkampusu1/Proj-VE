"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
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
import { contentStatusLabel, contentStatusLabels, contentStatusTone, formatDate } from "@/lib/utils";
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

const STATUS_OPTIONS = Object.entries(contentStatusLabels).map(([value, label]) => ({ value, label }));

interface MentionedUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

interface BlogDetail {
  id: string;
  createdById: string;
  brandId: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  category: string | null;
  targetPage: string | null;
  slug: string | null;
  focusKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  targetAudience: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  headingPlan: string | null;
  internalLinks: string[];
  externalLinks: string[];
  sources: string[];
  schemaType: string | null;
  canonicalUrl: string | null;
  indexStatus: string | null;
  geoTargetQuestions: string[];
  geoTargetAiQueries: string[];
  geoDirectAnswer: string | null;
  geoFaq: string | null;
  geoSourceCredibility: string | null;
  geoBrandUsage: string | null;
  geoStructuredDataNotes: string | null;
  geoQuotableBlocks: string | null;
  geoFreshnessDate: string | null;
  geoExpertReviewed: boolean;
  geoTrustedSources: string[];
  wordCount: number | null;
  readingTimeMinutes: number | null;
  scheduledAt: string | null;
  publishUrl: string | null;
  priority: string;
  editorId: string | null;
  internalNotes: string | null;
  status: string;
  mentions: { user: MentionedUser }[];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyState = {
  brandId: "",
  title: "",
  summary: "",
  body: "",
  category: "",
  targetPage: "",
  slug: "",
  focusKeyword: "",
  secondaryKeywords: [] as string[],
  searchIntent: "",
  targetAudience: "",
  metaTitle: "",
  metaDescription: "",
  h1: "",
  headingPlan: "",
  internalLinks: [] as string[],
  externalLinks: [] as string[],
  sources: [] as string[],
  schemaType: "",
  canonicalUrl: "",
  indexStatus: "",
  geoTargetQuestions: [] as string[],
  geoTargetAiQueries: [] as string[],
  geoDirectAnswer: "",
  geoFaq: "",
  geoSourceCredibility: "",
  geoBrandUsage: "",
  geoStructuredDataNotes: "",
  geoQuotableBlocks: "",
  geoFreshnessDate: "",
  geoExpertReviewed: false,
  geoTrustedSources: [] as string[],
  wordCount: "",
  readingTimeMinutes: "",
  publishUrl: "",
  priority: "MEDIUM",
  editorId: "",
  internalNotes: "",
  status: "IDEA",
};

/**
 * Blog + SEO + GEO içerik modalı (bkz. proje talebi §8). Alan sayısı çok
 * fazla olduğu için üç katmana ayrılmıştır: zorunlu temel alanlar üstte,
 * "SEO Bilgileri" ve "GEO (AI Arama) Bilgileri" ayrı açılır bölümlerde.
 */
export function BlogContentModal({
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
  const [form, setForm] = useState(emptyState);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [createdById, setCreatedById] = useState<string | null>(null);

  const [showSeo, setShowSeo] = useState(false);
  const [showGeo, setShowGeo] = useState(false);
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

  function set<K extends keyof typeof emptyState>(key: K, value: (typeof emptyState)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!open) return;
    if (!contentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("edit");
      setForm(emptyState);
      setScheduledDate("");
      setScheduledTime("09:00");
      setMentionedUsers([]);
      setCreatedById(null);
      setShowSeo(false);
      setShowGeo(false);
      setError(null);
      return;
    }

    setLoading(true);
    setMode("view");
    fetch(`/api/content/blog/${contentId}`)
      .then((res) => res.json())
      .then((data) => {
        const c: BlogDetail = data.content;
        setForm({
          brandId: c.brandId ?? "",
          title: c.title,
          summary: c.summary ?? "",
          body: c.body ?? "",
          category: c.category ?? "",
          targetPage: c.targetPage ?? "",
          slug: c.slug ?? "",
          focusKeyword: c.focusKeyword ?? "",
          secondaryKeywords: c.secondaryKeywords ?? [],
          searchIntent: c.searchIntent ?? "",
          targetAudience: c.targetAudience ?? "",
          metaTitle: c.metaTitle ?? "",
          metaDescription: c.metaDescription ?? "",
          h1: c.h1 ?? "",
          headingPlan: c.headingPlan ?? "",
          internalLinks: c.internalLinks ?? [],
          externalLinks: c.externalLinks ?? [],
          sources: c.sources ?? [],
          schemaType: c.schemaType ?? "",
          canonicalUrl: c.canonicalUrl ?? "",
          indexStatus: c.indexStatus ?? "",
          geoTargetQuestions: c.geoTargetQuestions ?? [],
          geoTargetAiQueries: c.geoTargetAiQueries ?? [],
          geoDirectAnswer: c.geoDirectAnswer ?? "",
          geoFaq: c.geoFaq ?? "",
          geoSourceCredibility: c.geoSourceCredibility ?? "",
          geoBrandUsage: c.geoBrandUsage ?? "",
          geoStructuredDataNotes: c.geoStructuredDataNotes ?? "",
          geoQuotableBlocks: c.geoQuotableBlocks ?? "",
          geoFreshnessDate: c.geoFreshnessDate ? c.geoFreshnessDate.slice(0, 10) : "",
          geoExpertReviewed: c.geoExpertReviewed ?? false,
          geoTrustedSources: c.geoTrustedSources ?? [],
          wordCount: c.wordCount != null ? String(c.wordCount) : "",
          readingTimeMinutes: c.readingTimeMinutes != null ? String(c.readingTimeMinutes) : "",
          publishUrl: c.publishUrl ?? "",
          priority: c.priority,
          editorId: c.editorId ?? "",
          internalNotes: c.internalNotes ?? "",
          status: c.status,
        });
        if (c.scheduledAt) {
          const d = new Date(c.scheduledAt);
          setScheduledDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
          setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
        } else {
          setScheduledDate("");
          setScheduledTime("09:00");
        }
        setMentionedUsers(c.mentions.map((m) => m.user));
        setCreatedById(c.createdById);
      })
      .finally(() => setLoading(false));
  }, [open, contentId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Lütfen başlık girin.");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      brandId: form.brandId || null,
      title: form.title,
      summary: form.summary || null,
      body: form.body || null,
      category: form.category || null,
      targetPage: form.targetPage || null,
      slug: form.slug || null,
      focusKeyword: form.focusKeyword || null,
      secondaryKeywords: form.secondaryKeywords,
      searchIntent: form.searchIntent || null,
      targetAudience: form.targetAudience || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      h1: form.h1 || null,
      headingPlan: form.headingPlan || null,
      internalLinks: form.internalLinks,
      externalLinks: form.externalLinks,
      sources: form.sources,
      schemaType: form.schemaType || null,
      canonicalUrl: form.canonicalUrl || "",
      indexStatus: form.indexStatus || null,
      geoTargetQuestions: form.geoTargetQuestions,
      geoTargetAiQueries: form.geoTargetAiQueries,
      geoDirectAnswer: form.geoDirectAnswer || null,
      geoFaq: form.geoFaq || null,
      geoSourceCredibility: form.geoSourceCredibility || null,
      geoBrandUsage: form.geoBrandUsage || null,
      geoStructuredDataNotes: form.geoStructuredDataNotes || null,
      geoQuotableBlocks: form.geoQuotableBlocks || null,
      geoFreshnessDate: form.geoFreshnessDate ? new Date(`${form.geoFreshnessDate}T00:00:00`).toISOString() : null,
      geoExpertReviewed: form.geoExpertReviewed,
      geoTrustedSources: form.geoTrustedSources,
      wordCount: form.wordCount ? Number(form.wordCount) : null,
      readingTimeMinutes: form.readingTimeMinutes ? Number(form.readingTimeMinutes) : null,
      scheduledAt: scheduledDate ? new Date(`${scheduledDate}T${scheduledTime || "09:00"}:00`).toISOString() : null,
      priority: form.priority,
      editorId: form.editorId || null,
      internalNotes: form.internalNotes || null,
      mentionedUserIds: mentionedUsers.map((u) => u.id),
    };
    if (isEdit) {
      payload.publishUrl = form.publishUrl || "";
      if (canEditStatus) payload.status = form.status;
    }

    const res = await fetch(isEdit ? `/api/content/blog/${contentId}` : "/api/content/blog", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "İçerik kaydedilemedi.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteContent() {
    if (!contentId) return;
    await fetch(`/api/content/blog/${contentId}`, { method: "DELETE" });
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
      title={isEdit ? (mode === "view" ? "Blog İçeriği" : "Blog İçeriğini Düzenle") : "Yeni Blog İçeriği"}
      wide
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : mode === "view" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={contentStatusTone[form.status] ?? "slate"}>{contentStatusLabel(form.status)}</Badge>
              {form.priority === "URGENT" && <Badge tone="red">Acil</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{form.title}</h2>
            <p className="text-xs text-muted-foreground">
              {[brands.find((b) => b.id === form.brandId)?.name, scheduledDate ? `Planlanan: ${formatDate(scheduledDate)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <ContentViewSections
            sections={[
              {
                fields: [
                  { label: "Özet", data: paragraphF(form.summary), fullWidth: true },
                  { label: "İçerik / Taslak Metin", data: paragraphF(form.body), fullWidth: true },
                ],
              },
              {
                title: "SEO Bilgileri",
                fields: [
                  { label: "Kategori", data: textF(form.category) },
                  { label: "Hedef Sayfa", data: textF(form.targetPage) },
                  { label: "Slug (URL)", data: textF(form.slug) },
                  { label: "Odak Anahtar Kelime", data: textF(form.focusKeyword) },
                  { label: "Arama Amacı", data: textF(form.searchIntent) },
                  { label: "İkincil Anahtar Kelimeler", data: chipsF(form.secondaryKeywords), fullWidth: true },
                  { label: "Meta Başlık", data: textF(form.metaTitle) },
                  { label: "H1", data: textF(form.h1) },
                  { label: "Meta Açıklama", data: paragraphF(form.metaDescription), fullWidth: true },
                  { label: "Başlık Planı", data: paragraphF(form.headingPlan), fullWidth: true },
                  { label: "İç Bağlantılar", data: chipsF(form.internalLinks), fullWidth: true },
                  { label: "Dış Bağlantılar", data: chipsF(form.externalLinks), fullWidth: true },
                  { label: "Kaynaklar", data: chipsF(form.sources), fullWidth: true },
                  { label: "Şema Türü", data: textF(form.schemaType) },
                  { label: "Canonical URL", data: linkF(form.canonicalUrl) },
                  { label: "İndeks Durumu", data: textF(form.indexStatus) },
                  { label: "Kelime Sayısı", data: textF(form.wordCount) },
                  { label: "Okuma Süresi (dk)", data: textF(form.readingTimeMinutes) },
                  { label: "Hedef Kitle", data: textF(form.targetAudience) },
                ],
              },
              {
                title: "GEO (AI Arama) Bilgileri",
                fields: [
                  { label: "Hedeflenen Sorular", data: chipsF(form.geoTargetQuestions), fullWidth: true },
                  { label: "Hedeflenen AI Sorguları", data: chipsF(form.geoTargetAiQueries), fullWidth: true },
                  { label: "Doğrudan Cevap Bloğu", data: paragraphF(form.geoDirectAnswer), fullWidth: true },
                  { label: "SSS (FAQ) İçeriği", data: paragraphF(form.geoFaq), fullWidth: true },
                  { label: "Kaynak Güvenilirliği Notu", data: textF(form.geoSourceCredibility) },
                  { label: "Marka Kullanımı Notu", data: textF(form.geoBrandUsage) },
                  { label: "Yapılandırılmış Veri Notları", data: paragraphF(form.geoStructuredDataNotes), fullWidth: true },
                  { label: "Alıntılanabilir Bloklar", data: paragraphF(form.geoQuotableBlocks), fullWidth: true },
                  { label: "Güncellik Tarihi", data: textF(form.geoFreshnessDate ? formatDate(form.geoFreshnessDate) : null) },
                  { label: "Uzman İncelemesi", data: textF(form.geoExpertReviewed ? "İncelendi" : null) },
                  { label: "Güvenilir Kaynaklar", data: chipsF(form.geoTrustedSources), fullWidth: true },
                ],
              },
              {
                fields: [
                  { label: "Yayın Bağlantısı", data: linkF(form.publishUrl) },
                  { label: "Dahili Notlar", data: paragraphF(form.internalNotes), fullWidth: true },
                ],
              },
            ]}
          />

          {form.editorId && (
            <div className="space-y-2">
              <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Atananlar
              </h3>
              {(() => {
                const m = findMember(form.editorId);
                return (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Avatar name={m?.name ?? null} email={m?.email ?? ""} image={m?.image} size={22} />
                    <span>{m?.name || m?.email} · Editör</span>
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
                İçeriği Sil
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
              <Label className="text-xs text-muted-foreground">Başlık</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marka</Label>
              <SimpleSelect
                value={form.brandId}
                onValueChange={(v) => set("brandId", v)}
                placeholder="Seçilmedi"
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Özet</Label>
            <Textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">İçerik / Taslak Metin</Label>
            <Textarea rows={5} value={form.body} onChange={(e) => set("body", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Planlanan Tarih</Label>
              <DatePicker value={scheduledDate} onChange={setScheduledDate} minDate={isEdit ? undefined : todayIso()} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Saat</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} disabled={!scheduledDate} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Öncelik</Label>
              <SimpleSelect value={form.priority} onValueChange={(v) => set("priority", v)} options={PRIORITY_OPTIONS} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Editör</Label>
              <SimpleSelect
                value={form.editorId}
                onValueChange={(v) => set("editorId", v)}
                placeholder="Atanmadı"
                options={members.map((m) => ({ value: m.id, label: m.name || m.email }))}
              />
            </div>
            {canEditStatus && (
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Durum</Label>
                <SimpleSelect value={form.status} onValueChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etiketlenen Kişiler</Label>
            <AssigneePicker selected={mentionedUsers} members={members} onChange={(ids) => setMentionedUsers(members.filter((m) => ids.includes(m.id)))} />
          </div>

          <button
            type="button"
            onClick={() => setShowSeo((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            SEO Bilgileri
            {showSeo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSeo && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hedef Sayfa</Label>
                  <Input value={form.targetPage} onChange={(e) => set("targetPage", e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Slug (URL)</Label>
                  <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Odak Anahtar Kelime</Label>
                  <Input value={form.focusKeyword} onChange={(e) => set("focusKeyword", e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Arama Amacı</Label>
                  <Input value={form.searchIntent} onChange={(e) => set("searchIntent", e.target.value)} placeholder="Bilgi / Ticari / İşlemsel" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">İkincil Anahtar Kelimeler</Label>
                <TagInput value={form.secondaryKeywords} onChange={(v) => set("secondaryKeywords", v)} placeholder="anahtar kelime ekle..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Meta Başlık</Label>
                  <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">H1</Label>
                  <Input value={form.h1} onChange={(e) => set("h1", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Meta Açıklama</Label>
                <Textarea rows={2} value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Başlık Planı (H2/H3 taslağı)</Label>
                <Textarea rows={3} value={form.headingPlan} onChange={(e) => set("headingPlan", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">İç Bağlantılar</Label>
                  <TagInput value={form.internalLinks} onChange={(v) => set("internalLinks", v)} placeholder="bağlantı ekle..." />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dış Bağlantılar</Label>
                  <TagInput value={form.externalLinks} onChange={(v) => set("externalLinks", v)} placeholder="bağlantı ekle..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kaynaklar</Label>
                <TagInput value={form.sources} onChange={(v) => set("sources", v)} placeholder="kaynak ekle..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Şema Türü</Label>
                  <Input value={form.schemaType} onChange={(e) => set("schemaType", e.target.value)} placeholder="Article, FAQPage..." />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Canonical URL</Label>
                  <Input value={form.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="https://..." />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">İndeks Durumu</Label>
                  <Input value={form.indexStatus} onChange={(e) => set("indexStatus", e.target.value)} placeholder="Index / Noindex" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kelime Sayısı</Label>
                  <Input type="number" min={0} value={form.wordCount} onChange={(e) => set("wordCount", e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Okuma Süresi (dk)</Label>
                  <Input type="number" min={0} value={form.readingTimeMinutes} onChange={(e) => set("readingTimeMinutes", e.target.value)} />
                </div>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hedef Kitle</Label>
                <Input value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGeo((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            GEO (AI Arama) Bilgileri
            {showGeo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showGeo && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hedeflenen Sorular</Label>
                <TagInput value={form.geoTargetQuestions} onChange={(v) => set("geoTargetQuestions", v)} placeholder="soru ekle..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hedeflenen AI Sorguları</Label>
                <TagInput value={form.geoTargetAiQueries} onChange={(v) => set("geoTargetAiQueries", v)} placeholder="sorgu ekle..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Doğrudan Cevap Bloğu</Label>
                <Textarea rows={2} value={form.geoDirectAnswer} onChange={(e) => set("geoDirectAnswer", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SSS (FAQ) İçeriği</Label>
                <Textarea rows={3} value={form.geoFaq} onChange={(e) => set("geoFaq", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kaynak Güvenilirliği Notu</Label>
                  <Input value={form.geoSourceCredibility} onChange={(e) => set("geoSourceCredibility", e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Marka Kullanımı Notu</Label>
                  <Input value={form.geoBrandUsage} onChange={(e) => set("geoBrandUsage", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Yapılandırılmış Veri Notları</Label>
                <Textarea rows={2} value={form.geoStructuredDataNotes} onChange={(e) => set("geoStructuredDataNotes", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alıntılanabilir Bloklar</Label>
                <Textarea rows={2} value={form.geoQuotableBlocks} onChange={(e) => set("geoQuotableBlocks", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Güncellik Tarihi</Label>
                  <DatePicker value={form.geoFreshnessDate} onChange={(v) => set("geoFreshnessDate", v)} />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      checked={form.geoExpertReviewed}
                      onChange={(e) => set("geoExpertReviewed", e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Uzman tarafından incelendi
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Güvenilir Kaynaklar</Label>
                <TagInput value={form.geoTrustedSources} onChange={(v) => set("geoTrustedSources", v)} placeholder="kaynak ekle..." />
              </div>
            </div>
          )}

          {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Yayın Bağlantısı</Label>
              <Input value={form.publishUrl} onChange={(e) => set("publishUrl", e.target.value)} placeholder="https://..." />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Dahili Notlar</Label>
            <Textarea rows={2} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-1">
            {canDelete ? (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                İçeriği Sil
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
        description="Bu blog içeriğini silmek istediğinize emin misiniz?"
        onConfirm={deleteContent}
      />
    </Modal>
  );
}
