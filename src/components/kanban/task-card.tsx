"use client";

import {
  Pin,
  Repeat,
  CalendarDays,
  Clock3,
  ListChecks,
  PlayCircle,
  MessageSquare,
  Flame,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Link2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { TagBadge } from "@/components/tags/tag-badge";
import { cn, formatDate } from "@/lib/utils";
import { getYoutubeVideoId, youtubeThumbnailUrl } from "@/lib/youtube";
import { detectSocialPlatform, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/lib/social-link";
import { SOCIAL_PLATFORM_TONE, SOCIAL_PLATFORM_ICONS } from "@/components/kanban/social-icons";
import type { TaskWithRelations } from "@/components/kanban/types";

/**
 * Kartta gösterilecek küçük ikon rozeti — revizyon #327: kapak (banner)
 * olarak seçilmemiş HER ek için, "kartta göster" işaretlenmiş olsun ya da
 * olmasın otomatik olarak görünür (kullanıcı talebi: "link eklendiği anda
 * kartta göster demesekte icon olarak göster ... hepsini göster").
 */
type CardBadge =
  | { id: string; kind: "pdf" }
  | { id: string; kind: "youtube" }
  | { id: string; kind: "image" }
  | { id: string; kind: "file" }
  | { id: string; kind: "link" }
  | { id: string; kind: "social"; platform: SocialPlatform };

const MAX_VISIBLE_ASSIGNEES = 3;

export function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isDragging,
  isDragOver,
}: {
  task: TaskWithRelations;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}) {
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const visibleAssignees = task.assignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const extraAssignees = task.assignees.length - visibleAssignees.length;

  // Revizyon #327: "kartta göster" artık yalnızca kapak/banner görselini
  // seçmek için kullanılır (tek seçim — bkz. attachments PATCH route'undaki
  // sunucu taraflı tekilleştirme) ve yalnızca resim/YouTube türü ekler kapak
  // olabilir. Kapak yalnızca `showOnCard === true` işaretli ekten üretilir;
  // hiçbiri işaretli değilse büyük görsel gösterilmez.
  const cardImages = task.cardImages ?? [];

  let bannerAttachmentId: string | null = null;
  let cardImageSrc: string | null = null;
  let cardImageYoutubeId: string | null = null;
  const bannerCandidate = cardImages.find((img) => img.showOnCard);
  if (bannerCandidate) {
    const isUploadImage = bannerCandidate.kind === "UPLOAD" && (bannerCandidate.mimeType || "").startsWith("image/");
    const ytId =
      bannerCandidate.kind === "LINK" && bannerCandidate.externalUrl
        ? getYoutubeVideoId(bannerCandidate.externalUrl)
        : null;
    if (isUploadImage) {
      bannerAttachmentId = bannerCandidate.id;
      cardImageSrc = `/api/tasks/${task.id}/attachments/${bannerCandidate.id}/download?inline=1`;
    } else if (ytId) {
      bannerAttachmentId = bannerCandidate.id;
      cardImageYoutubeId = ytId;
      cardImageSrc = youtubeThumbnailUrl(ytId);
    }
  }

  // HER ek TÜRÜ — kapak (banner) olarak kullanılsın kullanılmasın, "kartta
  // göster" işaretli olsun olmasın — küçük ikon rozeti olarak listelenir
  // (kullanıcı talebi: "link eklendiği anda kartta göster demesekte icon
  // olarak göster ... hepsini göster" ve "resim iconu kalıcak" — kapak
  // olarak seçilen görsel için de "resim eklendi" rozeti kaybolmasın). PDF/
  // YouTube/sosyal platform ayrımı social-link.ts'teki aynı tespit deseniyle
  // yapılır (bkz. task-modal.tsx'teki önizlemeyle paylaşılan mantık);
  // tanınmayan türler için genel dosya/bağlantı ikonuna düşülür. Revizyon:
  // "4 tane instagram eklersem 4 ikon değil TEK ikon görünsün" — aynı TÜRDEN
  // (örn. aynı platform) birden fazla ek varsa rozet TÜRE göre tekilleştirilir,
  // her ek için ayrı ayrı değil.
  const seenBadgeKeys = new Set<string>();
  const cardBadges: CardBadge[] = cardImages
    .map((img): CardBadge => {
      if (img.kind === "UPLOAD") {
        if (img.mimeType === "application/pdf") return { id: img.id, kind: "pdf" };
        if ((img.mimeType || "").startsWith("image/")) return { id: img.id, kind: "image" };
        return { id: img.id, kind: "file" };
      }
      if (img.externalUrl) {
        const ytId = getYoutubeVideoId(img.externalUrl);
        if (ytId) return { id: img.id, kind: "youtube" };
        const platform = detectSocialPlatform(img.externalUrl);
        if (platform) return { id: img.id, kind: "social", platform };
      }
      return { id: img.id, kind: "link" };
    })
    .filter((badge) => {
      const key = badge.kind === "social" ? `social:${badge.platform}` : badge.kind;
      if (seenBadgeKeys.has(key)) return false;
      seenBadgeKeys.add(key);
      return true;
    });

  // Görevlendirme #201: not eklendikçe kartta kırmızı sayaç rozeti görünür.
  const commentCount = task.commentCount ?? 0;

  // Revizyon: öncelik artık iki düzeyli (Normal/Acil) — "Normal" kartta hiç
  // gösterilmiyor (çoğu görev bu düzeyde olacağı için gürültü yapmasın),
  // yalnızca "Acil" işaretli görevler belirgin kırmızı bir rozet + sol kenar
  // vurgusuyla öne çıkarılıyor.
  const isUrgent = task.priority === "URGENT";

  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-card-hover)]",
        isUrgent && "border-l-[3px] border-l-tint-red-foreground",
        isDragging && "scale-[0.97] opacity-50 shadow-none",
        isDragOver && "border-primary/60 ring-1 ring-primary/40",
        !isDragging && "animate-task-drop",
      )}
    >
      {cardImageSrc && (
        <div className="relative h-24 w-full bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImageSrc} alt="" className="h-full w-full object-cover" />
          {cardImageYoutubeId && (
            <PlayCircle className="absolute inset-0 m-auto h-8 w-8 text-white drop-shadow" />
          )}
        </div>
      )}

      <div className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          {task.kind === "FIXED" && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sabit görev" />
          )}
          {task.recurringTemplateId && (
            <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Her gün tekrarlar" />
          )}
          <span className="truncate">{task.title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {commentCount > 0 && (
            <span
              className="flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
              title={`${commentCount} not`}
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {commentCount}
            </span>
          )}
          {isUrgent && (
            <span
              className="flex items-center gap-0.5 rounded-full bg-tint-red px-1.5 py-0.5 text-[10px] font-semibold leading-none text-tint-red-foreground"
              title="Acil düzey"
            >
              <Flame className="h-2.5 w-2.5" />
              ACİL
            </span>
          )}
        </div>
      </div>

      {/* Revizyon #327: banner olmayan ekler (2. video, PDF, sosyal medya
          bağlantıları) kendi ayrı satırında, metin etiketi DEĞİL, platformun
          KENDİ İKONU ile küçük kare rozetler olarak listelenir — kullanıcı
          talebi: "instagram - tiktok - youtube eklentiler geldiği gibi
          kartta icon olarak görünsün" (metin rozetleri yerine gerçek
          logo/ikon). Ayırt edilebilirlik artık ikon şeklinden gelir (renk
          tonu ikincil), bkz. social-icons.tsx SOCIAL_PLATFORM_ICONS. */}
      {cardBadges.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {cardBadges.map((badge) => {
            if (badge.kind === "pdf") {
              return (
                <span
                  key={badge.id}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground/80"
                  title="PDF eki"
                >
                  <FileText className="h-3.5 w-3.5" />
                </span>
              );
            }
            if (badge.kind === "youtube") {
              return (
                <span
                  key={badge.id}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-tint-red text-tint-red-foreground"
                  title="YouTube video"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                </span>
              );
            }
            if (badge.kind === "image") {
              return (
                <span
                  key={badge.id}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground/80"
                  title="Görsel eki"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </span>
              );
            }
            if (badge.kind === "file") {
              return (
                <span
                  key={badge.id}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground/80"
                  title="Dosya eki"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </span>
              );
            }
            if (badge.kind === "link") {
              return (
                <span
                  key={badge.id}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground/80"
                  title="Bağlantı eki"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </span>
              );
            }
            const PlatformIcon = SOCIAL_PLATFORM_ICONS[badge.platform];
            return (
              <span
                key={badge.id}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  SOCIAL_PLATFORM_TONE[badge.platform],
                )}
                title={SOCIAL_PLATFORM_LABELS[badge.platform]}
              >
                <PlatformIcon className="h-3.5 w-3.5" />
              </span>
            );
          })}
        </div>
      )}

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      )}

      {(task.scheduledDate || task.dueDate || task.subtasks.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          {task.scheduledDate && (
            <span className="flex items-center gap-1" title="Planlanan tarih">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(task.scheduledDate)}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1" title="Son tarih">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className="flex items-center gap-1" title="Kontrol listesi">
              <ListChecks className="h-3.5 w-3.5" />
              {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-muted-foreground">
          {task.creator && (
            <span title={`Oluşturan: ${task.creator.name || task.creator.email}`}>
              {task.creator.name || task.creator.email}
            </span>
          )}
        </div>
        {task.assignees.length > 0 && (
          <div className="flex shrink-0 items-center -space-x-1.5">
            {visibleAssignees.map((a) => (
              <Avatar
                key={a.id}
                name={a.name}
                email={a.email}
                image={a.image}
                size={22}
                className="ring-2 ring-card"
              />
            ))}
            {extraAssignees > 0 && (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-foreground/80 ring-2 ring-card">
                +{extraAssignees}
              </span>
            )}
          </div>
        )}
      </div>
      </div>
    </button>
  );
}
