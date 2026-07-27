/**
 * Bir URL'nin YouTube video bağlantısı olup olmadığını tespit eder ve varsa
 * video kimliğini döner (bkz. görev #197 — göreve YouTube videosu eklerken
 * küçük bir önizleme görseli göstermek için kullanılır). youtube.com/watch,
 * youtu.be/ID ve youtube.com/shorts/ID biçimlerini destekler.
 */
export function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
