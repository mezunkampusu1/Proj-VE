/**
 * Revizyon: "Döküman türlerinde hepsini kaldır 2 tane olsun biri word
 * formatı bir tanesi excel formatı" — "Doküman Türü" artık yalnızca bir
 * etiket değil, editörün HANGİ biçimde açılacağını da belirliyor (Word =
 * zengin metin/Yjs, Excel = formül destekli tablo/otomatik kayıt).
 *
 * Kasıtlı olarak SLUG değil, sabit ID üzerinden karşılaştırma yapılır:
 * `PATCH /api/document-types/[typeId]` türün adını (ve buradan hesaplanan
 * slug'ını) yeniden adlandırmaya izin veriyor (yalnızca isSystem türler
 * silinemiyor, yeniden adlandırma serbest) — id ise hiçbir zaman değişmez,
 * bu yüzden format tespiti için güvenilir tek alan budur.
 */
export const WORD_DOCUMENT_TYPE_ID = "dt_word";
export const EXCEL_DOCUMENT_TYPE_ID = "dt_excel";

export type DocumentFormat = "WORD" | "EXCEL";

/**
 * Türü silinmiş / hiç tür atanmamış dokümanlar da dahil her şey Word
 * kabul edilir (bkz. migration'daki geriye dönük atama kararı) — yalnızca
 * Excel türüne AÇIKÇA atanmış dokümanlar tablo editörüyle açılır.
 */
export function getDocumentFormat(typeId: string | null | undefined): DocumentFormat {
  return typeId === EXCEL_DOCUMENT_TYPE_ID ? "EXCEL" : "WORD";
}
