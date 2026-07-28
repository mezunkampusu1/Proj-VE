import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Sabit sistem doküman türleri (bkz. src/lib/document-format.ts) — Ortak
 * Alan istemcisi bu ID'leri (`dt_word`/`dt_excel`) hardcoded gönderdiği için
 * her ortamda (dev/prod) bu iki kaydın var olması zorunlu. `POST
 * /api/document-types` kasıtlı olarak devre dışı bırakıldığından bu kayıtlar
 * başka hiçbir yerde oluşturulmuyor; upsert `update` bölümü de dolduruldu ki
 * biri isSystem/slug/name alanlarını elle yanlış düzenlerse seed tekrar
 * çalıştırıldığında doğru değerlere geri dönsün.
 */
const documentTypeDefaults: Array<{ id: string; name: string; slug: string; isSystem: boolean }> = [
  { id: "dt_word", name: "Word", slug: "word", isSystem: true },
  { id: "dt_excel", name: "Excel", slug: "excel", isSystem: true },
];

async function ensureDocumentTypes() {
  for (const dt of documentTypeDefaults) {
    await prisma.documentType.upsert({
      where: { id: dt.id },
      update: { name: dt.name, slug: dt.slug, isSystem: dt.isSystem },
      create: dt,
    });
  }
}

async function main() {
  await ensureDocumentTypes();

  const password = await bcrypt.hash("password123", 12);

  const owner = await prisma.user.upsert({
    where: { email: "demo@follow-up.local" },
    update: {},
    create: { name: "Demo Kullanıcı", email: "demo@follow-up.local", password },
  });

  const teammate = await prisma.user.upsert({
    where: { email: "ayse@follow-up.local" },
    update: {},
    create: { name: "Ayşe Yılmaz", email: "ayse@follow-up.local", password },
  });

  const team = await prisma.team.upsert({
    where: { slug: "demo-takim" },
    update: {},
    create: {
      name: "Demo Takım",
      slug: "demo-takim",
      members: {
        create: [
          { userId: owner.id, role: "ADMIN" },
          { userId: teammate.id, role: "MEMBER" },
        ],
      },
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: { teamId: team.id, name: "Web Sitesi Yenileme" },
  });

  const todayDate = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        teamId: team.id,
        name: "Web Sitesi Yenileme",
        description: "Kurumsal web sitesinin yeniden tasarımı ve geliştirilmesi.",
        // Sabit TaskStatus enum'u kalktığı için her proje kendi TaskColumn
        // setiyle açılır — burada da API'nin varsayılan 4 sütunuyla aynı set
        // (bkz. src/lib/tasks.ts createDefaultColumns).
        columns: {
          create: [
            { name: "Yapılacak", order: 0, isDoneColumn: false },
            { name: "Devam Ediyor", order: 1, isDoneColumn: false },
            { name: "Kontrol Edilecek", order: 2, isDoneColumn: false },
            { name: "Tamamlandı", order: 3, isDoneColumn: true },
          ],
        },
      },
    }));

  if (!existingProject) {
    const columns = await prisma.taskColumn.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    });
    const todoColumn = columns.find((c) => c.order === 0)!;
    const inProgressColumn = columns.find((c) => c.order === 1)!;
    const doneColumn = columns.find((c) => c.order === 3)!;

    // Görev #196 (çoklu atama) sonrası Task.assigneeId kalktı; atama artık
    // TaskAssignee join tablosu üzerinden yazılır. createMany nested
    // ilişki yazımını desteklemediği için (Prisma sınırlaması) burada tek
    // tek create() kullanılır.
    await prisma.task.create({
      data: {
        projectId: project.id,
        columnId: doneColumn.id,
        title: "Wireframe tasarımlarını hazırla",
        description: "Ana sayfa ve ürün sayfaları için wireframe.",
        priority: "MEDIUM",
        position: 0,
        scheduledDate: todayDate,
        assignees: { create: [{ userId: teammate.id }] },
        creatorId: owner.id,
      },
    });
    await prisma.task.create({
      data: {
        projectId: project.id,
        columnId: inProgressColumn.id,
        title: "Ana sayfa arayüzünü kodla",
        priority: "HIGH",
        position: 0,
        scheduledDate: todayDate,
        assignees: { create: [{ userId: owner.id }] },
        creatorId: owner.id,
      },
    });
    await prisma.task.create({
      data: {
        projectId: project.id,
        columnId: todoColumn.id,
        title: "SEO denetimi yap",
        priority: "LOW",
        position: 0,
        scheduledDate: todayDate,
        creatorId: owner.id,
      },
    });
  }

  console.log("Seed tamamlandı:");
  console.log(`  Doküman türleri: ${documentTypeDefaults.map((dt) => dt.slug).join(", ")}`);
  console.log(`  Takım: ${team.name} (${team.slug})`);
  console.log(`  Proje: ${project.name}`);
  console.log("  Giriş bilgileri: demo@follow-up.local / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
