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
import {
  contentStatusLabel,
  contentStatusLabels,
  contentStatusTone,
  formatDate,
  socialContentTypeLabel,
  socialContentTypesByPlatform,
  socialPlatformLabel,
  socialPlatformLabels,
} from "@/lib/utils";
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

const PLATFORM_OPTIONS = Object.entries(socialPlatformLabels).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(contentStatusLabels).map(([value, label]) => ({ value, label }));

interface MentionedUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

interface ContentDetail {
  id: string;
  createdById: string;
  brandId: string | null;
  platform: string;
  contentType: string;
  title: string;
  postText: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  hashtags: string[];
  mentionAccounts: string[];
  location: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  targetAudience: string | null;
  contentGoal: string | null;
  campaign: string | null;
  keywords: string[];
  altText: string | null;
  scheduledAt: string | null;
  publishUrl: string | null;
  priority: string;
  designerId: string | null;
  videoEditorId: string | null;
  internalNotes: string | null;
  status: string;
  mentions: { user: MentionedUser }[];
  performance: {
    impressions: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    linkClicks: number | null;
    followerGain: number | null;
    videoWatchSeconds: number | null;
    engagementRate: number | null;
  } | null;
}

const emptyPerformance = {
  impressions: "",
  reach: "",
  likes: "",
  comments: "",
  shares: "",
  saves: "",
  linkClicks: "",
  followerGain: "",
  videoWatchSeconds: "",
  engagementRate: "",
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Sosyal medya içeriği oluşturma/düzenleme modalı (bkz. proje talebi §5).
 * Zorunlu alanlar üstte, platforma özgü/gelişmiş alanlar "Ek Bilgiler"
 * altında — Finans modülündeki modal deseniyle aynı yaklaşım.
 */
export function SocialContentModal({
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
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [contentType, setContentType] = useState("");
  const [title, setTitle] = useState("");
  const [postText, setPostText] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mentionAccounts, setMentionAccounts] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [campaign, setCampaign] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [altText, setAltText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [publishUrl, setPublishUrl] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [designerId, setDesignerId] = useState("");
  const [videoEditorId, setVideoEditorId] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("IDEA");
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [performance, setPerformance] = useState(emptyPerformance);
  const [savingPerformance, setSavingPerformance] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  // Kullanıcı talebi: kartı açmak doğrudan düzenleme formuna değil, önce
  // salt-okunur bir görüntüleme moduna götürsün — "Düzenle" ile forma geçilir.
  // Yeni kayıt oluştururken (contentId yok) gösterilecek bir şey olmadığından
  // doğrudan forma gidilir.
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const contentTypeOptions = socialContentTypesByPlatform[platform] ?? [];
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
      setPlatform("INSTAGRAM");
      setContentType("");
      setTitle("");
      setPostText("");
      setShortDescription("");
      setLongDescription("");
      setHashtags([]);
      setMentionAccounts([]);
      setLocation("");
      setLinkUrl("");
      setCtaText("");
      setTargetAudience("");
      setContentGoal("");
      setCampaign("");
      setKeywords([]);
      setAltText("");
      setScheduledDate("");
      setScheduledTime("09:00");
      setPublishUrl("");
      setPriority("MEDIUM");
      setDesignerId("");
      setVideoEditorId("");
      setInternalNotes("");
      setStatus("IDEA");
      setMentionedUsers([]);
      setCreatedById(null);
      setPerformance(emptyPerformance);
      setShowAdvanced(false);
      setError(null);
      return;
    }

    setLoading(true);
    setMode("view");
    fetch(`/api/content/social/${contentId}`)
      .then((res) => res.json())
      .then((data) => {
        const c: ContentDetail = data.content;
        setBrandId(c.brandId ?? "");
        setPlatform(c.platform);
        setContentType(c.contentType);
        setTitle(c.title);
        setPostText(c.postText ?? "");
        setShortDescription(c.shortDescription ?? "");
        setLongDescription(c.longDescription ?? "");
        setHashtags(c.hashtags ?? []);
        setMentionAccounts(c.mentionAccounts ?? []);
        setLocation(c.location ?? "");
        setLinkUrl(c.linkUrl ?? "");
        setCtaText(c.ctaText ?? "");
        setTargetAudience(c.targetAudience ?? "");
        setContentGoal(c.contentGoal ?? "");
        setCampaign(c.campaign ?? "");
        setKeywords(c.keywords ?? []);
        setAltText(c.altText ?? "");
        if (c.scheduledAt) {
          const d = new Date(c.scheduledAt);
          setScheduledDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
          setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
        } else {
          setScheduledDate("");
          setScheduledTime("09:00");
        }
        setPublishUrl(c.publishUrl ?? "");
        setPriority(c.priority);
        setDesignerId(c.designerId ?? "");
        setVideoEditorId(c.videoEditorId ?? "");
        setInternalNotes(c.internalNotes ?? "");
        setStatus(c.status);
        setMentionedUsers(c.mentions.map((m) => m.user));
        setCreatedById(c.createdById);
        setPerformance(
          c.performance
            ? {
                impressions: c.performance.impressions != null ? String(c.performance.impressions) : "",
                reach: c.performance.reach != null ? String(c.performance.reach) : "",
                likes: c.performance.likes != null ? String(c.performance.likes) : "",
                comments: c.performance.comments != null ? String(c.performance.comments) : "",
                shares: c.performance.shares != null ? String(c.performance.shares) : "",
                saves: c.performance.saves != null ? String(c.performance.saves) : "",
                linkClicks: c.performance.linkClicks != null ? String(c.performance.linkClicks) : "",
                followerGain: c.performance.followerGain != null ? String(c.performance.followerGain) : "",
                videoWatchSeconds: c.performance.videoWatchSeconds != null ? String(c.performance.videoWatchSeconds) : "",
                engagementRate: c.performance.engagementRate != null ? String(c.performance.engagementRate) : "",
              }
            : emptyPerformance,
        );
      })
      .finally(() => setLoading(false));
  }, [open, contentId]);

  function setPerf<K extends keyof typeof emptyPerformance>(key: K, value: string) {
    setPerformance((prev) => ({ ...prev, [key]: value }));
  }

  async function savePerformance() {
    if (!contentId) return;
    setSavingPerformance(true);
    await fetch(`/api/content/social/${contentId}/performance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        impressions: performance.impressions ? Number(performance.impressions) : null,
        reach: performance.reach ? Number(performance.reach) : null,
        likes: performance.likes ? Number(performance.likes) : null,
        comments: performance.comments ? Number(performance.comments) : null,
        shares: performance.shares ? Number(performance.shares) : null,
        saves: performance.saves ? Number(performance.saves) : null,
        linkClicks: performance.linkClicks ? Number(performance.linkClicks) : null,
        followerGain: performance.followerGain ? Number(performance.followerGain) : null,
        videoWatchSeconds: performance.videoWatchSeconds ? Number(performance.videoWatchSeconds) : null,
        engagementRate: performance.engagementRate ? Number(performance.engagementRate) : null,
      }),
    });
    setSavingPerformance(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Lütfen başlık girin.");
      return;
    }
    if (!contentType) {
      setError("Lütfen içerik türü seçin.");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      brandId: brandId || null,
      platform,
      contentType,
      title,
      postText: postText || null,
      shortDescription: shortDescription || null,
      longDescription: longDescription || null,
      hashtags,
      mentionAccounts,
      location: location || null,
      linkUrl: linkUrl || "",
      ctaText: ctaText || null,
      targetAudience: targetAudience || null,
      contentGoal: contentGoal || null,
      campaign: campaign || null,
      keywords,
      altText: altText || null,
      scheduledAt: scheduledDate ? new Date(`${scheduledDate}T${scheduledTime || "09:00"}:00`).toISOString() : null,
      priority,
      designerId: designerId || null,
      videoEditorId: videoEditorId || null,
      internalNotes: internalNotes || null,
      mentionedUserIds: mentionedUsers.map((u) => u.id),
    };
    if (isEdit) {
      payload.publishUrl = publishUrl || "";
      if (canEditStatus) payload.status = status;
    }

    const res = await fetch(
      isEdit ? `/api/content/social/${contentId}` : "/api/content/social",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

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
    await fetch(`/api/content/social/${contentId}`, { method: "DELETE" });
    setConfirmDeleteOpen(false);
    onSaved();
    onClose();
  }

  function findMember(id: string) {
    return members.find((m) => m.id === id) ?? null;
  }

  const hasPerformance = Object.values(performance).some((v) => v !== "");

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? (mode === "view" ? "İçerik" : "İçeriği Düzenle") : "Yeni Sosyal Medya İçeriği"} wide>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : mode === "view" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={contentStatusTone[status] ?? "slate"}>{contentStatusLabel(status)}</Badge>
              <Badge tone="slate">{socialPlatformLabel(platform)}</Badge>
              <span className="text-xs text-muted-foreground">{socialContentTypeLabel(platform, contentType)}</span>
              {priority === "URGENT" && <Badge tone="red">Acil</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {[brands.find((b) => b.id === brandId)?.name, scheduledDate ? `Planlanan: ${formatDate(scheduledDate)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <ContentViewSections
            sections={[
              { fields: [{ label: "Gönderi Metni", data: paragraphF(postText), fullWidth: true }] },
              {
                title: "Ek Bilgiler",
                fields: [
                  { label: "Kısa Açıklama", data: paragraphF(shortDescription), fullWidth: true },
                  { label: "Uzun Açıklama", data: paragraphF(longDescription), fullWidth: true },
                  { label: "Hashtag'ler", data: chipsF(hashtags), fullWidth: true },
                  { label: "Etiketlenecek Hesaplar", data: chipsF(mentionAccounts), fullWidth: true },
                  { label: "Anahtar Kelimeler", data: chipsF(keywords), fullWidth: true },
                  { label: "Konum", data: textF(location) },
                  { label: "Bağlantı", data: linkF(linkUrl) },
                  { label: "CTA Metni", data: textF(ctaText) },
                  { label: "Kampanya", data: textF(campaign) },
                  { label: "Hedef Kitle", data: textF(targetAudience) },
                  { label: "İçerik Amacı", data: textF(contentGoal) },
                  { label: "Alt Metin", data: textF(altText) },
                  { label: "Yayın Bağlantısı", data: linkF(publishUrl) },
                  { label: "Dahili Notlar", data: paragraphF(internalNotes), fullWidth: true },
                ],
              },
            ]}
          />

          {(designerId || videoEditorId) && (
            <div className="space-y-2">
              <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Atananlar
              </h3>
              <div className="flex flex-wrap gap-4">
                {designerId &&
                  (() => {
                    const m = findMember(designerId);
                    return (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Avatar name={m?.name ?? null} email={m?.email ?? ""} image={m?.image} size={22} />
                        <span>{m?.name || m?.email} · Tasarımcı</span>
                      </div>
                    );
                  })()}
                {videoEditorId &&
                  (() => {
                    const m = findMember(videoEditorId);
                    return (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Avatar name={m?.name ?? null} email={m?.email ?? ""} image={m?.image} size={22} />
                        <span>{m?.name || m?.email} · Video Editörü</span>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          {mentionedUsers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etiketlenen Kişiler</h3>
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

          {status === "PUBLISHED" && hasPerformance && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Performans Verileri</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Erişim", performance.reach],
                  ["Gösterim", performance.impressions],
                  ["Beğeni", performance.likes],
                  ["Yorum", performance.comments],
                  ["Paylaşım", performance.shares],
                  ["Kaydetme", performance.saves],
                  ["Bağlantı Tıklaması", performance.linkClicks],
                  ["Yeni Takipçi", performance.followerGain],
                  ["Video İzlenme (sn)", performance.videoWatchSeconds],
                  ["Etkileşim Oranı (%)", performance.engagementRate],
                ]
                  .filter(([, v]) => v !== "")
                  .map(([label, value]) => (
                    <div key={label as string} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value}</p>
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <SimpleSelect
                value={platform}
                onValueChange={(v) => {
                  setPlatform(v);
                  setContentType("");
                }}
                options={PLATFORM_OPTIONS}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">İçerik Türü</Label>
              <SimpleSelect
                value={contentType}
                onValueChange={setContentType}
                placeholder="Seçin..."
                options={contentTypeOptions}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marka</Label>
              <SimpleSelect
                value={brandId}
                onValueChange={setBrandId}
                placeholder="Seçilmedi"
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Başlık</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="İçeriği tanımlayan kısa başlık" required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Gönderi Metni</Label>
            <Textarea rows={3} value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Paylaşılacak metin..." />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Planlanan Tarih</Label>
              <DatePicker value={scheduledDate} onChange={setScheduledDate} minDate={isEdit ? undefined : todayIso()} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Saat</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} disabled={!scheduledDate} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Öncelik</Label>
              <SimpleSelect value={priority} onValueChange={setPriority} options={PRIORITY_OPTIONS} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tasarımcı</Label>
              <SimpleSelect
                value={designerId}
                onValueChange={setDesignerId}
                placeholder="Atanmadı"
                options={members.map((m) => ({ value: m.id, label: m.name || m.email }))}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Video Editörü</Label>
              <SimpleSelect
                value={videoEditorId}
                onValueChange={setVideoEditorId}
                placeholder="Atanmadı"
                options={members.map((m) => ({ value: m.id, label: m.name || m.email }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etiketlenen Kişiler</Label>
            <AssigneePicker selected={mentionedUsers} members={members} onChange={(ids) => setMentionedUsers(members.filter((m) => ids.includes(m.id)))} />
          </div>

          {canEditStatus && (
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Durum</Label>
              <SimpleSelect value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
          >
            Ek Bilgiler
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kısa Açıklama</Label>
                  <Textarea rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Uzun Açıklama</Label>
                  <Textarea rows={2} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hashtag&apos;ler</Label>
                  <TagInput value={hashtags} onChange={setHashtags} prefix="#" placeholder="hashtag ekle..." />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Etiketlenecek Hesaplar</Label>
                  <TagInput value={mentionAccounts} onChange={setMentionAccounts} prefix="@" placeholder="hesap ekle..." />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anahtar Kelimeler</Label>
                <TagInput value={keywords} onChange={setKeywords} placeholder="anahtar kelime ekle..." />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Konum</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bağlantı</Label>
                  <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CTA Metni</Label>
                  <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Örn. Hemen Başvur" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Kampanya</Label>
                  <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hedef Kitle</Label>
                  <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">İçerik Amacı</Label>
                  <Input value={contentGoal} onChange={(e) => setContentGoal(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alt Metin (görsel erişilebilirlik)</Label>
                <Input value={altText} onChange={(e) => setAltText(e.target.value)} />
              </div>

              {isEdit && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Yayın Bağlantısı</Label>
                  <Input value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dahili Notlar</Label>
                <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
            </div>
          )}

          {isEdit && status === "PUBLISHED" && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label className="text-xs text-muted-foreground">Performans Verileri (bkz. proje talebi §9)</Label>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input type="number" min={0} placeholder="Erişim" value={performance.reach} onChange={(e) => setPerf("reach", e.target.value)} />
                <Input type="number" min={0} placeholder="Gösterim" value={performance.impressions} onChange={(e) => setPerf("impressions", e.target.value)} />
                <Input type="number" min={0} placeholder="Beğeni" value={performance.likes} onChange={(e) => setPerf("likes", e.target.value)} />
                <Input type="number" min={0} placeholder="Yorum" value={performance.comments} onChange={(e) => setPerf("comments", e.target.value)} />
                <Input type="number" min={0} placeholder="Paylaşım" value={performance.shares} onChange={(e) => setPerf("shares", e.target.value)} />
                <Input type="number" min={0} placeholder="Kaydetme" value={performance.saves} onChange={(e) => setPerf("saves", e.target.value)} />
                <Input type="number" min={0} placeholder="Bağlantı Tıklaması" value={performance.linkClicks} onChange={(e) => setPerf("linkClicks", e.target.value)} />
                <Input type="number" min={0} placeholder="Yeni Takipçi" value={performance.followerGain} onChange={(e) => setPerf("followerGain", e.target.value)} />
                <Input type="number" min={0} placeholder="Video İzlenme (sn)" value={performance.videoWatchSeconds} onChange={(e) => setPerf("videoWatchSeconds", e.target.value)} />
                <Input type="number" min={0} step="0.01" placeholder="Etkileşim Oranı (%)" value={performance.engagementRate} onChange={(e) => setPerf("engagementRate", e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="secondary" disabled={savingPerformance} onClick={savePerformance}>
                  {savingPerformance ? "Kaydediliyor..." : "Performansı Kaydet"}
                </Button>
              </div>
            </div>
          )}

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
        description="Bu içeriği silmek istediğinize emin misiniz?"
        onConfirm={deleteContent}
      />
    </Modal>
  );
}
