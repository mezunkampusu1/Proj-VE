/**
 * Hedefli, idempotent düzeltme scripti: yalnızca sabit sistem doküman
 * türlerini (`dt_word`/`dt_excel`, bkz. src/lib/document-format.ts) garanti
 * eder. Production'da `npm run db:seed` (demo kullanıcı/takım/proje dahil
 * tüm seed) çalıştırmak istemediğimiz durumlar için ayrıldı — bu script
 * document_types dışında HİÇBİR tabloya dokunmaz.
 *
 * Bu listeyi prisma/seed.ts içindeki documentTypeDefaults ile aynı tut;
 * biri değişirse diğerini de güncelle.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const documentTypeDefaults: Array<{ id: string; name: string; slug: string; isSystem: boolean }> = [
  { id: "dt_word", name: "Word", slug: "word", isSystem: true },
  { id: "dt_excel", name: "Excel", slug: "excel", isSystem: true },
];

async function main() {
  for (const dt of documentTypeDefaults) {
    const result = await prisma.documentType.upsert({
      where: { id: dt.id },
      update: { name: dt.name, slug: dt.slug, isSystem: dt.isSystem },
      create: dt,
    });
    console.log(`OK  ${result.id} -> name=${result.name} slug=${result.slug} isSystem=${result.isSystem}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
