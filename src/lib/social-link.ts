/**
 * Görev #319: göreve eklenen bir bağlantının hangi sosyal platforma ait
 * olduğunu tespit eder (bkz. lib/youtube.ts — aynı istemci taraflı URL-desen
 * eşleştirme deseni, backend/şema desteği gerekmez; `TaskAttachment.kind`
 * zaten genel LINK türüdür, platforma özel bir sütun eklemeye gerek yok).
 * Tespit edilen platform, task-modal.tsx'te ek önizlemesi (marka rengi +
 * ikon + etiket kartı) ve task-card.tsx'te kart rozeti (bkz. görev #320)
 * için kullanılır.
 */
export type SocialPlatform = "instagram" | "tiktok" | "linkedin" | "facebook" | "x";

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
};

function normalizeHost(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname.replace(/^www\./, "").toLowerCase(), path: u.pathname };
  } catch {
    return null;
  }
}

export function detectSocialPlatform(url: string): SocialPlatform | null {
  const parsed = normalizeHost(url);
  if (!parsed) return null;
  const { host } = parsed;

  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") return "linkedin";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return "facebook";
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) return "x";

  return null;
}
