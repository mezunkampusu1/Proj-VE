import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Shadcn/UI standart sınıf birleştirme yardımcısı (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  URGENT: "Acil",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Yönetici",
  MEMBER: "Üye",
};

const degreeLevelLabels: Record<string, string> = {
  YUKSEK_LISANS: "Yüksek Lisans",
  DOKTORA: "Doktora",
};

const atlasFieldLabels: Record<string, string> = {
  name: "Ad",
  instituteId: "Enstitü",
  degreeLevel: "Derece",
  isActive: "Aktiflik",
  entryDate: "Giriş Tarihi",
};

export function degreeLevelLabel(level: string) {
  return degreeLevelLabels[level] ?? level;
}

export function atlasFieldLabel(field: string) {
  return atlasFieldLabels[field] ?? field;
}

export function priorityLabel(priority: string) {
  return priorityLabels[priority] ?? priority;
}

export function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}

export function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email || "?";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// Görev #317: sunucu (Docker konteyneri) varsayılan olarak UTC saat
// diliminde çalışıyor — `toLocaleDateString`/`toLocaleTimeString` açık
// `timeZone` verilmeden çağrıldığında UTC'ye düşüyor, bu da Türkiye saatinin
// (UTC+3) 3 saat geride görünmesine neden oluyordu ("Mesai kısmında zaman 3
// saat geri geliyor" — bkz. kullanıcı talebi). Tüm tarih/saat formatlayıcıları
// artık açıkça Europe/Istanbul saat dilimini kullanıyor.
const TR_TIME_ZONE = "Europe/Istanbul";

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TR_TIME_ZONE,
  });
}

/**
 * Göreceli zaman metni üretir ("az önce", "5 dk önce", "3 sa önce",
 * "2 gün önce"); bir haftadan eskiyse okunabilirlik için tam tarihe
 * düşer (formatDate). Bildirim merkezinde kullanılır.
 */
export function formatRelativeTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 45) return "az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;
  return formatDate(d);
}

/** Saat:dakika gösterimi ("09:34") — bildirim/zaman çizelgesi metinlerinde kullanılır. */
export function formatTime(date: string | Date | null | undefined) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TR_TIME_ZONE });
}

/** Saniyeyi "04:12" (SS:DD) biçiminde gösterir — Günlük Akış aktif süre göstergesi. */
export function formatDurationHM(totalSeconds: number) {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Saniyeyi "26 dk" biçiminde gösterir — Günlük Akış ara süresi göstergesi. */
export function formatDurationMinutes(totalSeconds: number) {
  return `${Math.round(Math.max(0, totalSeconds) / 60)} dk`;
}

const dailyFlowStatusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  ON_BREAK: "Arada",
  COMPLETED: "Gün Tamamlandı",
  NOT_STARTED: "Henüz Başlamadı",
};

export function dailyFlowStatusLabel(status: string) {
  return dailyFlowStatusLabels[status] ?? status;
}

const dailyFlowFieldLabels: Record<string, string> = {
  startedAt: "Başlangıç saati",
  completedAt: "Bitiş saati",
  note: "Günlük not",
  status: "Durum",
};

export function dailyFlowFieldLabel(field: string) {
  return dailyFlowFieldLabels[field] ?? field;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const documentStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  IN_PROGRESS: "Devam Ediyor",
  IN_REVIEW: "İncelemede",
  BEING_REVISED: "Revize Ediliyor",
  PENDING_APPROVAL: "Onay Bekliyor",
  APPROVED: "Onaylandı",
  READY_TO_PUBLISH: "Yayına Hazır",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşivlendi",
};

/** Ortak Alan doküman durumunu Türkçe okunabilir metne çevirir (§13). */
export function documentStatusLabel(status: string) {
  return documentStatusLabels[status] ?? status;
}

const documentAccessLevelLabels: Record<string, string> = {
  VIEWER: "Görüntüleyebilir",
  COMMENTER: "Yorum Yapabilir",
  EDITOR: "Düzenleyebilir",
  OWNER: "Sahip",
};

export function documentAccessLevelLabel(level: string) {
  return documentAccessLevelLabels[level] ?? level;
}

const documentAuditActionLabels: Record<string, string> = {
  CREATED: "Oluşturuldu",
  EDITED: "Düzenlendi",
  DELETED: "Çöp kutusuna taşındı",
  RESTORED: "Geri yüklendi",
  PERMANENTLY_DELETED: "Kalıcı olarak silindi",
  PERMISSION_GRANTED: "Yetki verildi",
  PERMISSION_REVOKED: "Yetki kaldırıldı",
  SHARED: "Paylaşıldı",
  DOWNLOADED: "İndirildi",
  EXPORTED: "Dışa aktarıldı",
  COMMENT_ADDED: "Yorum eklendi",
  COMMENT_DELETED: "Yorum silindi",
  SUGGESTION_ACCEPTED: "Öneri kabul edildi",
  SUGGESTION_REJECTED: "Öneri reddedildi",
  VERSION_RESTORED: "Sürüm geri yüklendi",
  OWNER_CHANGED: "Sahip değiştirildi",
  APPROVAL_REQUESTED: "Onaya gönderildi",
  APPROVAL_GRANTED: "Onaylandı",
  REVISION_REQUESTED: "Revizyon istendi",
  APPROVAL_REJECTED: "Reddedildi",
  APPROVAL_WITHDRAWN: "Onay talebi geri çekildi",
};

/** Ortak Alan denetim kaydı eylemini Türkçe okunabilir metne çevirir (§22). */
export function documentAuditActionLabel(action: string) {
  return documentAuditActionLabels[action] ?? action;
}

const moduleNameLabels: Record<string, string> = {
  TASKS: "Projelendirme",
  ANNOUNCEMENTS: "Duyurular",
  DATES: "Tarihler",
  ATLAS: "Atlas",
  FILES: "Dosyalar",
  USER_REPORTS: "Kullanıcı Raporları",
  TEAM: "Ekip",
  UNIVERSITIES: "Üniversiteler",
  DAILY_FLOW: "Günlük Akış",
  DOCUMENTS: "Ortak Alan",
  FINANCE: "Finans",
  CONTENT: "Sosyal Medya & İçerik",
};

/** Aktivite günlüğündeki modül adını Türkçe okunabilir metne çevirir (bkz. activity-log-view.tsx). */
export function moduleNameLabel(module: string | null | undefined) {
  if (!module) return "Genel";
  return moduleNameLabels[module] ?? module;
}

const activityActionLabels: Record<string, string> = {
  PROJECT_CREATED: "Proje oluşturuldu",
  TASK_CREATED: "Görev oluşturuldu",
  TASK_UPDATED: "Görev güncellendi",
  TASK_STATUS_CHANGED: "Görev durumu değişti",
  TASK_ASSIGNED: "Görev atandı",
  TASK_DELETED: "Görev silindi",
  COMMENT_ADDED: "Yorum eklendi",
  TASK_COLUMN_CREATED: "Sütun oluşturuldu",
  TASK_COLUMN_UPDATED: "Sütun güncellendi",
  TASK_COLUMN_DELETED: "Sütun silindi",
  RECURRING_TASK_CREATED: "Tekrarlayan görev oluşturuldu",
  RECURRING_TASK_UPDATED: "Tekrarlayan görev güncellendi",
  RECURRING_TASK_DELETED: "Tekrarlayan görev silindi",
  MEMBER_JOINED: "Ekibe katıldı",
  MEMBER_ROLE_CHANGED: "Rol değiştirildi",
  DAILY_STAT_RECORDED: "Günlük veri girildi",
  ANNOUNCEMENT_CREATED: "Duyuru oluşturuldu",
  ANNOUNCEMENT_UPDATED: "Duyuru güncellendi",
  ANNOUNCEMENT_DELETED: "Duyuru silindi",
  ANNOUNCEMENT_TYPE_CREATED: "Duyuru türü eklendi",
  DATE_CREATED: "Tarih eklendi",
  DATE_UPDATED: "Tarih güncellendi",
  DATE_DELETED: "Tarih silindi",
  DATE_TYPE_CREATED: "Tarih türü eklendi",
  ATLAS_PROGRAM_CREATED: "Atlas programı eklendi",
  ATLAS_PROGRAM_UPDATED: "Atlas programı güncellendi",
  ATLAS_PROGRAM_REMOVED: "Atlas programı kaldırıldı",
  INSTITUTE_CREATED: "Enstitü eklendi",
  INSTITUTE_UPDATED: "Enstitü güncellendi",
  INSTITUTE_DELETED: "Enstitü silindi",
  INSTITUTE_IMPORTED: "Enstitü içe aktarıldı",
  FILE_UPLOADED: "Dosya yüklendi",
  FILE_DELETED: "Dosya silindi",
  ATTACHMENT_ADDED: "Ek eklendi",
  ATTACHMENT_REMOVED: "Ek kaldırıldı",
  UNIVERSITY_CREATED: "Üniversite eklendi",
  UNIVERSITY_UPDATED: "Üniversite güncellendi",
  UNIVERSITY_IMPORTED: "Üniversite içe aktarıldı",
  DAILY_FLOW_STARTED: "Günlük akış başlatıldı",
  DAILY_FLOW_BREAK_STARTED: "Ara verildi",
  DAILY_FLOW_BREAK_ENDED: "Akışa dönüldü",
  DAILY_FLOW_COMPLETED: "Gün tamamlandı",
  DAILY_FLOW_EDITED: "Günlük akış kaydı düzenlendi",
  DAILY_FLOW_REOPENED: "Gün yeniden açıldı",
  DAILY_FLOW_SETTING_UPDATED: "Günlük akış ayarı güncellendi",
  DOCUMENT_CREATED: "Doküman oluşturuldu",
  DOCUMENT_UPDATED: "Doküman güncellendi",
  DOCUMENT_DELETED: "Doküman silindi",
  DOCUMENT_RESTORED: "Doküman geri yüklendi",
  DOCUMENT_SHARED: "Doküman paylaşıldı",
  DOCUMENT_STATUS_CHANGED: "Doküman durumu değişti",
  DOCUMENT_APPROVED: "Doküman onaylandı",
  DOCUMENT_FOLDER_CREATED: "Klasör oluşturuldu",
  FINANCE_RECORD_CREATED: "Finans kaydı eklendi",
  FINANCE_RECORD_UPDATED: "Finans kaydı güncellendi",
  FINANCE_RECORD_DELETED: "Finans kaydı silindi",
  FINANCE_RECORD_STATUS_CHANGED: "Finans kaydı durumu değişti",
  FINANCE_CATEGORY_CREATED: "Finans kategorisi eklendi",
  FINANCE_CATEGORY_UPDATED: "Finans kategorisi güncellendi",
  FINANCE_CATEGORY_DELETED: "Finans kategorisi silindi",
  FINANCE_RATE_UPDATED: "Para birimi/kur güncellendi",
  FINANCE_RECURRING_CREATED: "Tekrarlayan finans kaydı oluşturuldu",
  FINANCE_RECURRING_UPDATED: "Tekrarlayan finans kaydı güncellendi",
  FINANCE_RECURRING_DELETED: "Tekrarlayan finans kaydı silindi",
  FINANCE_PERMISSION_UPDATED: "Finans yetkileri güncellendi",
  CONTENT_CREATED: "İçerik oluşturuldu",
  CONTENT_UPDATED: "İçerik güncellendi",
  CONTENT_DELETED: "İçerik silindi",
  CONTENT_RESTORED: "İçerik geri yüklendi",
  CONTENT_STATUS_CHANGED: "İçerik durumu değişti",
  CONTENT_APPROVED: "İçerik onaylandı",
  CONTENT_REVISION_REQUESTED: "Revizyon istendi",
  CONTENT_PUBLISHED: "İçerik yayınlandı",
  CONTENT_ASSET_ADDED: "Dosya eklendi",
  CONTENT_ASSET_REMOVED: "Dosya kaldırıldı",
  CONTENT_PERMISSION_UPDATED: "İçerik yetkileri güncellendi",
  DAILY_WORK_REPORT_SUBMITTED: "Günlük çalışma raporu gönderildi",
  DAILY_WORK_REPORT_REVIEWED: "Günlük çalışma raporu değerlendirildi",
  AI_CONTENT_GENERATED: "Yapay zekâ içeriği üretildi",
};

/** Aktivite günlüğündeki eylem türünü Türkçe okunabilir metne çevirir (bkz. activity-log-view.tsx). */
export function activityActionLabel(action: string) {
  return activityActionLabels[action] ?? action;
}

// ---------------------------------------------------------------------------
// Modül 9 — Finans Takip: etiket/rozet yardımcıları
// ---------------------------------------------------------------------------

export const financePaymentMethodLabels: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Havalesi",
  AUTOMATIC_PAYMENT: "Otomatik Ödeme",
  OTHER: "Diğer",
};
export function financePaymentMethodLabel(v: string | null | undefined) {
  return v ? (financePaymentMethodLabels[v] ?? v) : "—";
}

export const financeStatusLabels: Record<string, string> = {
  PAID: "Ödendi",
  PENDING: "Bekliyor",
  PARTIALLY_PAID: "Kısmen Ödendi",
  CANCELLED: "İptal Edildi",
};
export function financeStatusLabel(v: string) {
  return financeStatusLabels[v] ?? v;
}
export const financeStatusTone: Record<string, "slate" | "blue" | "amber" | "red" | "green"> = {
  PAID: "green",
  PENDING: "amber",
  PARTIALLY_PAID: "blue",
  CANCELLED: "slate",
};

export const financeVisibilityLabels: Record<string, string> = {
  ADMIN_ONLY: "Sadece adminler",
  OWNER_AND_ADMIN: "Kişiye özel (oluşturan + adminler)",
  SPECIFIC_USERS: "Seçilen kullanıcılar",
  DEPARTMENT: "İlgili departman",
  TEAM: "Tüm ekiple paylaşılıyor",
};
export function financeVisibilityLabel(v: string) {
  return financeVisibilityLabels[v] ?? v;
}

export const financeRecurrenceFrequencyLabels: Record<string, string> = {
  WEEKLY: "Haftalık",
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMIANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
  CUSTOM: "Özel periyot",
};
export function financeRecurrenceFrequencyLabel(v: string) {
  return financeRecurrenceFrequencyLabels[v] ?? v;
}

// ---------------------------------------------------------------------------
// Modül 10 — Sosyal Medya, İçerik ve SEO Yönetimi: etiket/rozet yardımcıları
// ---------------------------------------------------------------------------

export const contentStatusLabels: Record<string, string> = {
  IDEA: "Fikir",
  DRAFT: "Taslak",
  IN_PROGRESS: "Hazırlanıyor",
  AWAITING_DESIGN: "Tasarım bekliyor",
  AWAITING_VIDEO: "Video düzenleme bekliyor",
  AWAITING_REVIEW: "Kontrol bekliyor",
  AWAITING_APPROVAL: "Onay bekliyor",
  REVISION_REQUESTED: "Revizyon istendi",
  APPROVED: "Onaylandı",
  SCHEDULED: "Planlandı",
  PUBLISHED: "Yayınlandı",
  CANCELLED: "İptal edildi",
  ARCHIVED: "Arşivlendi",
};
export function contentStatusLabel(v: string) {
  return contentStatusLabels[v] ?? v;
}
export const contentStatusTone: Record<
  string,
  "slate" | "blue" | "amber" | "red" | "green"
> = {
  IDEA: "slate",
  DRAFT: "slate",
  IN_PROGRESS: "blue",
  AWAITING_DESIGN: "amber",
  AWAITING_VIDEO: "amber",
  AWAITING_REVIEW: "amber",
  AWAITING_APPROVAL: "amber",
  REVISION_REQUESTED: "red",
  APPROVED: "green",
  SCHEDULED: "blue",
  PUBLISHED: "green",
  CANCELLED: "slate",
  ARCHIVED: "slate",
};

export const socialPlatformLabels: Record<string, string> = {
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TWITTER: "X / Twitter",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
};
export function socialPlatformLabel(v: string) {
  return socialPlatformLabels[v] ?? v;
}

/** Platforma göre geçerli içerik türleri (bkz. proje talebi §5 — "içerik türleri platforma göre dinamik olmalı"). */
export const socialContentTypesByPlatform: Record<string, { value: string; label: string }[]> = {
  INSTAGRAM: [
    { value: "POST", label: "Gönderi" },
    { value: "REELS", label: "Reels" },
    { value: "STORY", label: "Story" },
    { value: "CAROUSEL", label: "Carousel" },
    { value: "LIVE_ANNOUNCEMENT", label: "Canlı yayın duyurusu" },
  ],
  LINKEDIN: [
    { value: "TEXT_POST", label: "Metin gönderisi" },
    { value: "IMAGE_POST", label: "Görsel gönderisi" },
    { value: "ARTICLE", label: "Makale" },
    { value: "DOCUMENT", label: "Doküman paylaşımı" },
    { value: "VIDEO", label: "Video" },
    { value: "JOB_POST", label: "İş ilanı" },
    { value: "COMPANY_ANNOUNCEMENT", label: "Şirket duyurusu" },
  ],
  TWITTER: [
    { value: "SINGLE_POST", label: "Tek gönderi" },
    { value: "THREAD", label: "Gönderi zinciri" },
    { value: "IMAGE_POST", label: "Görselli gönderi" },
    { value: "VIDEO", label: "Video" },
    { value: "POLL", label: "Anket" },
    { value: "ANNOUNCEMENT", label: "Duyuru" },
  ],
  TIKTOK: [
    { value: "VIDEO", label: "Video" },
    { value: "SERIES", label: "Seri içeriği" },
    { value: "EDUCATIONAL", label: "Eğitim içeriği" },
    { value: "TREND", label: "Trend içerik" },
    { value: "INTERVIEW", label: "Röportaj" },
    { value: "PROMO", label: "Tanıtım" },
  ],
  FACEBOOK: [
    { value: "POST", label: "Gönderi" },
    { value: "IMAGE", label: "Görsel" },
    { value: "VIDEO", label: "Video" },
    { value: "STORY", label: "Hikâye" },
    { value: "EVENT", label: "Etkinlik" },
    { value: "LINK_SHARE", label: "Bağlantı paylaşımı" },
  ],
};
export function socialContentTypeLabel(platform: string, value: string) {
  return socialContentTypesByPlatform[platform]?.find((t) => t.value === value)?.label ?? value;
}

export const workCategoryLabels: Record<string, string> = {
  SOCIAL_POST: "Sosyal medya paylaşımı",
  CONTENT_CREATION: "İçerik üretimi",
  GRAPHIC_DESIGN: "Grafik hazırlama",
  VIDEO_EDITING: "Video düzenleme",
  REELS: "Reels hazırlama",
  STORY: "Story hazırlama",
  BLOG_POST: "Blog yazısı",
  SEO_WORK: "SEO çalışması",
  GEO_WORK: "GEO çalışması",
  KEYWORD_RESEARCH: "Anahtar kelime araştırması",
  COMPETITOR_ANALYSIS: "Rakip analizi",
  WEBSITE_CONTENT_UPDATE: "Site içi içerik güncellemesi",
  LANDING_PAGE_EDIT: "Landing page düzenlemesi",
  UNIVERSITY_PROGRAM_DATA_ENTRY: "Üniversite/program verisi girişi",
  ANNOUNCEMENT_ENTRY: "Duyuru girişi",
  PAGE_CHECK: "Sayfa kontrolü",
  BUG_CHECK: "Hata kontrolü",
  MODERATION: "Moderasyon",
  COMMENT_MANAGEMENT: "Yorum ve mesaj yönetimi",
  REPORTING: "Raporlama",
  OTHER: "Diğer",
};
export function workCategoryLabel(v: string) {
  return workCategoryLabels[v] ?? v;
}

export const seoWorkTypeLabels: Record<string, string> = {
  KEYWORD_RESEARCH: "Anahtar kelime araştırması",
  CONTENT_OPTIMIZATION: "İçerik optimizasyonu",
  TECHNICAL_SEO_CHECK: "Teknik SEO kontrolü",
  META_TITLE_EDIT: "Meta başlık düzenlemesi",
  META_DESCRIPTION_EDIT: "Meta açıklama düzenlemesi",
  INTERNAL_LINKING: "İç linkleme",
  IMAGE_SEO: "Görsel SEO",
  URL_EDIT: "URL düzenlemesi",
  SCHEMA_WORK: "Schema çalışması",
  COMPETITOR_ANALYSIS: "Rakip analizi",
  SEARCH_CONSOLE_CHECK: "Search Console kontrolü",
  SITEMAP_CHECK: "Site haritası kontrolü",
  BROKEN_LINK_CHECK: "Kırık bağlantı kontrolü",
  PAGE_SPEED_CHECK: "Sayfa hızı kontrolü",
  CONTENT_UPDATE: "İçerik güncelleme",
  GEO_OPTIMIZATION: "GEO optimizasyonu",
  AI_SEARCH_VISIBILITY: "Yapay zekâ arama görünürlüğü çalışması",
};
export function seoWorkTypeLabel(v: string) {
  return seoWorkTypeLabels[v] ?? v;
}

export const contentAssetRoleLabels: Record<string, string> = {
  COVER: "Kapak görseli",
  GALLERY: "Galeri",
  VIDEO: "Video",
  SCREENSHOT: "Ekran görüntüsü",
  DOCUMENT: "Belge",
  SUBTITLE: "Altyazı",
  OTHER: "Diğer",
};
export function contentAssetRoleLabel(v: string) {
  return contentAssetRoleLabels[v] ?? v;
}

export const dailyWorkReportStatusLabels: Record<string, string> = {
  SUBMITTED: "Gönderildi",
  APPROVED: "Onaylandı",
  REVISION_REQUESTED: "Revizyon istendi",
};
export function dailyWorkReportStatusLabel(v: string) {
  return dailyWorkReportStatusLabels[v] ?? v;
}

/** İsimden URL/DB dostu benzersiz-adaylık slug üretir (Türkçe karakterleri sadeleştirir). */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
