/**
 * Basit, process-içi (in-memory) sabit-pencere rate limiter. Redis/Upstash
 * gibi harici bir depoya ihtiyaç duymaz — tek `app` container'ında çalışan
 * bu sistem için yeterlidir (yatay ölçekleme durumunda paylaşılan bir depoya
 * taşınması gerekir).
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanupExpired(now: number, windowMs: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs) store.delete(key);
  }
}

/** Verilen anahtar için pencere dolmuş mu (max denemeye ulaşılmış mı) kontrol eder. */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  cleanupExpired(now, windowMs);

  const entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) return false;
  return entry.count >= max;
}

/** Bir başarısız denemeyi kaydeder; pencere süresi dolmuşsa yeni bir pencere başlatır. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

/** Başarılı bir denemeden sonra anahtarın kaydını temizler. */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
