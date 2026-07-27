import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Tam metin arama sonucu — sıralama için `rank` içerir. Belge kimliklerini
 * `to_tsvector('turkish', title || contentText) @@ plainto_tsquery(...)`
 * fonksiyonel GIN indeksi (bkz. migration'daki `documents_search_idx`)
 * üzerinden bulur; erişim/izin filtrelemesi bu fonksiyonun DIŞINDA, çağıran
 * route'ta (mevcut Prisma tabanlı izin mantığıyla, `src/lib/documents.ts`
 * ile tutarlı biçimde) yapılır — ham SQL içine izin mantığını gömmek yerine
 * bu ayrım tercih edildi, çünkü izin kuralları zaten iki yerde (bu route ve
 * collab-server) senkron tutulmaya çalışılıyor; üçüncü bir kopya açmamak
 * için burada yalnızca "hangi ID'ler eşleşiyor + rank" hesaplanır.
 */
export async function searchDocumentIdsByText(
  query: string,
  candidateIds: string[] | null,
): Promise<Map<string, number>> {
  const trimmed = query.trim();
  if (!trimmed) return new Map();

  const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>(
    Prisma.sql`
      SELECT id, ts_rank(
        to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce("contentText", '')),
        plainto_tsquery('turkish', ${trimmed})
      ) AS rank
      FROM documents
      WHERE "deletedAt" IS NULL
        AND to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce("contentText", ''))
            @@ plainto_tsquery('turkish', ${trimmed})
        ${candidateIds && candidateIds.length > 0 ? Prisma.sql`AND id IN (${Prisma.join(candidateIds)})` : Prisma.empty}
        ${candidateIds && candidateIds.length === 0 ? Prisma.sql`AND false` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT 200
    `,
  );

  return new Map(rows.map((r) => [r.id, Number(r.rank)]));
}
