/**
 * "YYYY-AA-GG" biçimindeki tarih-yalnızca girdilerini Prisma `DateTime`
 * alanlarına çevirir. Tarihler/Kullanıcı Raporları gibi modüllerde ortak
 * kullanılan küçük yardımcılar.
 */

/** Değer yoksa `undefined` döner (alan güncellenmez / oluşturmada boş bırakılır). */
export function toDateOrUndefined(value: string | null | undefined) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Güncellemede: alan gönderilmediyse `undefined`, boş string/null ise `null` (temizle). */
export function toDateOrNull(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}
