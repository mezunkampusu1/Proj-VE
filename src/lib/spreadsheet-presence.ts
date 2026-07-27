/**
 * Excel (fortune-sheet) dokümanları için "Şu Anda Burada" / canlı hücre
 * imleci desteği. Kullanıcı talebi: "Word'de bunu görebiliyorduk (imleç
 * yanında isim, kim burada listesi) — Excel'de de olur mu?"
 *
 * Word tarafı bu bilgiyi Yjs/Hocuspocus'un "awareness" mekanizmasından
 * bedava alır (kalıcı bir WebSocket bağlantısı var). Excel/fortune-sheet
 * için böyle bir altyapı yok — bu proje kasıtlı olarak Excel'i yoklama
 * (polling, ~1.5sn) tabanlı tutuyor (bkz. spreadsheet-editor.tsx). Bu
 * yüzden "kim şu an burada, hangi hücrede" bilgisi de aynı yoklama
 * ritmiyle taşınan HAFİF, KALICI OLMAYAN bir sunucu-içi durum olarak
 * tutulur — kalıcı bir veritabanı tablosu GEREKMEZ, çünkü bu bilgi zaten
 * "şu an" anlamına geliyor ve birkaç saniye sonra bayatlıyor (bkz.
 * PRESENCE_TTL_MS). Uygulama tek bir `app` konteyneri olarak çalıştığı
 * için (docker-compose.yml'de replikasyon yok) bellek-içi bir Map burada
 * güvenli ve yeterlidir — çoklu instance'a ölçeklenirse bunun yerine
 * Postgres veya Redis'e taşınması gerekir.
 */

export interface SpreadsheetPresenceEntry {
  userId: string;
  name: string;
  color: string;
  sheetId: string;
  row: number;
  column: number;
  updatedAt: number;
}

const PRESENCE_TTL_MS = 8000;

// documentId -> userId -> presence
const store = new Map<string, Map<string, SpreadsheetPresenceEntry>>();

function pruneStale(map: Map<string, SpreadsheetPresenceEntry>) {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  for (const [userId, entry] of map) {
    if (entry.updatedAt < cutoff) map.delete(userId);
  }
}

export function setSpreadsheetPresence(
  documentId: string,
  entry: Omit<SpreadsheetPresenceEntry, "updatedAt">,
) {
  let docMap = store.get(documentId);
  if (!docMap) {
    docMap = new Map();
    store.set(documentId, docMap);
  }
  docMap.set(entry.userId, { ...entry, updatedAt: Date.now() });
}

export function removeSpreadsheetPresence(documentId: string, userId: string) {
  store.get(documentId)?.delete(userId);
}

/** `excludeUserId` hariç, hâlâ taze (bkz. PRESENCE_TTL_MS) olan tüm kayıtlar. */
export function getSpreadsheetPresences(
  documentId: string,
  excludeUserId: string,
): SpreadsheetPresenceEntry[] {
  const docMap = store.get(documentId);
  if (!docMap) return [];
  pruneStale(docMap);
  if (docMap.size === 0) store.delete(documentId);
  return Array.from(docMap.values()).filter((e) => e.userId !== excludeUserId);
}
