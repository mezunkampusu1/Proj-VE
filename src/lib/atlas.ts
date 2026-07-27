import { prisma } from "@/lib/prisma";

const detailInclude = {
  institute: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
} as const;

interface AtlasProgramFields {
  instituteId: string;
  name: string;
  degreeLevel: "YUKSEK_LISANS" | "DOKTORA";
  isActive: boolean;
  /// Programın fiilen girildiği gün — Duyurular/Tarihler'deki `entryDate`
  /// ile aynı mantık (bkz. prisma/schema.prisma AtlasProgram.entryDate).
  entryDate: Date;
}

/** Değişiklik geçmişinde okunabilir olsun diye `Date` değerlerini
 * "YYYY-AA-GG" biçimine, diğerlerini olduğu gibi metne çevirir. */
function toLogValue(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

/**
 * Atlas programı (Üniversite > Enstitü > Program hiyerarşisinin en alt
 * kademesi) oluşturur ve tek bir `CREATED` denetim kaydı yazar.
 *
 * Bu dosya, `docs/ARCHITECTURE.md`'de öngörülen "her modülde tekrar
 * yazılmadan, merkezi bir yerde" ilkesini karşılar. Gerçek bir Prisma
 * `$extends` client-extension'ı yerine düz (ama tek bir kaynaktan çağrılan)
 * yardımcı fonksiyonlar kullanıldı: bu sandbox'ta `prisma generate`
 * çalışmadığından üretilen istemci tipleri eksik/kararsız — extension
 * tabanlı bir çözüm burada doğrulanamayan tip riskleri taşır. İşlevsel
 * olarak aynı hedefe (tek bir yerde diff/log mantığı, modül başına tekrar
 * yok) ulaşır; ileride `prisma generate` sorunsuz çalıştığında birebir
 * `$extends` sürümüne taşınabilir.
 */
export async function createAtlasProgramWithLog(
  data: AtlasProgramFields & { createdById: string },
) {
  return prisma.$transaction(async (tx) => {
    const program = await tx.atlasProgram.create({
      data: {
        instituteId: data.instituteId,
        name: data.name,
        degreeLevel: data.degreeLevel,
        isActive: data.isActive,
        entryDate: data.entryDate,
        createdById: data.createdById,
      },
      include: detailInclude,
    });

    await tx.atlasChangeLog.create({
      data: {
        programId: program.id,
        action: "CREATED",
        changedById: data.createdById,
      },
    });

    return program;
  });
}

/**
 * Bir Atlas programını günceller; değişen her alan için ayrı bir
 * `AtlasChangeLog` satırı yazar (eski/yeni değer, kim, ne zaman). `isActive`
 * alanı `false`'a çekilirse bu özel olarak `REMOVED` aksiyonu olarak
 * kaydedilir (programın kaldırıldığını netleştirmek için).
 */
export async function updateAtlasProgramWithLog(
  id: string,
  data: Partial<AtlasProgramFields>,
  changedById: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.atlasProgram.findUniqueOrThrow({ where: { id } });

    const program = await tx.atlasProgram.update({
      where: { id },
      data: {
        instituteId: data.instituteId,
        name: data.name,
        degreeLevel: data.degreeLevel,
        isActive: data.isActive,
        entryDate: data.entryDate,
      },
      include: detailInclude,
    });

    const trackedFields: (keyof AtlasProgramFields)[] = [
      "instituteId",
      "name",
      "degreeLevel",
      "isActive",
      "entryDate",
    ];

    for (const field of trackedFields) {
      if (data[field] === undefined) continue;
      const oldValue = before[field];
      const newValue = program[field];
      if (toLogValue(oldValue) === toLogValue(newValue)) continue;

      const isDeactivation = field === "isActive" && newValue === false;
      await tx.atlasChangeLog.create({
        data: {
          programId: id,
          action: isDeactivation ? "REMOVED" : "UPDATED",
          field,
          oldValue: toLogValue(oldValue),
          newValue: toLogValue(newValue),
          changedById,
        },
      });
    }

    return program;
  });
}

export { detailInclude as atlasProgramDetailInclude };
