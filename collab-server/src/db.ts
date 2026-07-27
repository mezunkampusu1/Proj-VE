import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export type AccessLevel = "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";

const LEVEL_RANK: Record<AccessLevel, number> = {
  VIEWER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
};

function maxLevel(a: AccessLevel | null, b: AccessLevel | null): AccessLevel | null {
  if (!a) return b;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/**
 * Bir kullanıcının bir dokümana erişim düzeyini belirler. Bu kontrol,
 * Next.js tarafındaki izin kontrolünden BAĞIMSIZ olarak burada da
 * (defense-in-depth) yapılır — spesifikasyonun "URL üzerinden yetkisiz
 * erişim kesinlikle engellenmelidir" gereksinimi gereği.
 *
 * Öncelik sırası: sahiplik/sistem admini > doküman-seviyesi izin >
 * klasör zincirinde en yakın (kök'e doğru) izin kaydı.
 */
export async function getAccessLevel(userId: string, documentId: string): Promise<AccessLevel | null> {
  const docRes = await pool.query(
    `SELECT "ownerId", "folderId", "teamId", "deletedAt" FROM documents WHERE id = $1`,
    [documentId],
  );
  if (docRes.rows.length === 0) return null;
  const doc = docRes.rows[0];
  if (doc.deletedAt) return null; // çöp kutusundaki dokümanlara canlı erişim yok

  if (doc.ownerId === userId) return "OWNER";

  const memberRes = await pool.query(
    `SELECT "teamId", role FROM team_members WHERE "userId" = $1`,
    [userId],
  );
  if (memberRes.rows.length === 0) return null; // ekibin üyesi değil
  const teamIds: string[] = memberRes.rows.map((r) => r.teamId);
  const roles: string[] = memberRes.rows.map((r) => r.role);

  // Sistem admini (mevcut rol sistemi) — tüm dokümanları yönetebilir.
  if (roles.includes("ADMIN")) return "OWNER";

  // Bug fix (kullanıcı talebi: "Word'de ortak çalışma hiç çalışmıyor, eskiden
  // çalışıyordu"): logs, MEMBER rollü (admin/sahip olmayan) bir kullanıcı
  // her authenticate denemesinde şu Postgres hatasını veriyordu: "operator
  // does not exist: TeamRole = text". Kök neden: "subjectRole" sütunu
  // Postgres'te "TeamRole" enum tipinde (bkz. prisma/schema.prisma,
  // DocumentPermission.subjectRole), ama burada ham metin dizisiyle
  // (ANY($4::text[])) karşılaştırılıyordu — Next.js tarafındaki Prisma
  // sorgu oluşturucusu enum/text dönüşümünü kendisi hallettiği için AYNI
  // mantığın burada (ham `pg` istemcisi, bkz. dosya başındaki not) birebir
  // kopyası bu tip uyuşmazlığını yakalayamamıştı. Sahip/admin olmayan HER
  // authenticate denemesi bu satıra ulaştığında sorgu Postgres hatasıyla
  // patlıyor, `onAuthenticate` reddediliyor, istemci hep "Çevrimdışı" kalıp
  // hiç kimseyi göremiyordu. Düzeltme: enum sütunu metne çevrilip
  // karşılaştırılıyor.
  const subjectMatch = `(
    ("subjectType" = 'USER' AND "subjectUserId" = $2) OR
    ("subjectType" = 'TEAM' AND "subjectTeamId" = ANY($3::text[])) OR
    ("subjectType" = 'ROLE' AND "subjectRole"::text = ANY($4::text[])) OR
    ("subjectType" = 'EVERYONE')
  )`;

  const docPerm = await pool.query(
    `SELECT level FROM document_permissions WHERE "documentId" = $1 AND ${subjectMatch}`,
    [documentId, userId, teamIds, roles],
  );
  let level: AccessLevel | null = null;
  for (const row of docPerm.rows) level = maxLevel(level, row.level as AccessLevel);
  if (level) return level;

  // Doküman-seviyesinde açık izin yoksa, klasör zincirinde köke doğru
  // en yakın izin kaydını ara (izin kalıtımı).
  let folderId: string | null = doc.folderId;
  while (folderId) {
    const folderPerm = await pool.query(
      `SELECT level FROM document_permissions WHERE "folderId" = $1 AND ${subjectMatch}`,
      [folderId, userId, teamIds, roles],
    );
    let folderLevel: AccessLevel | null = null;
    for (const row of folderPerm.rows) folderLevel = maxLevel(folderLevel, row.level as AccessLevel);
    if (folderLevel) return folderLevel;

    const parentRes = await pool.query(
      `SELECT "parentFolderId" FROM document_folders WHERE id = $1`,
      [folderId],
    );
    folderId = parentRes.rows[0]?.parentFolderId ?? null;
  }

  return null;
}

export async function loadYjsState(documentId: string): Promise<Buffer | null> {
  const res = await pool.query(`SELECT state FROM document_yjs_states WHERE "documentId" = $1`, [documentId]);
  if (res.rows.length === 0) return null;
  return res.rows[0].state as Buffer;
}

export async function saveYjsState(documentId: string, state: Buffer): Promise<void> {
  await pool.query(
    `INSERT INTO document_yjs_states ("documentId", state, "updatedAt")
     VALUES ($1, $2, now())
     ON CONFLICT ("documentId") DO UPDATE SET state = EXCLUDED.state, "updatedAt" = now()`,
    [documentId, state],
  );
}

export async function updateDocumentSnapshot(
  documentId: string,
  content: unknown,
  contentText: string,
  wordCount: number,
  charCount: number,
  lastEditedById: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET content = $2, "contentText" = $3, "wordCount" = $4, "charCount" = $5,
         "lastEditedById" = COALESCE($6, "lastEditedById"), "updatedAt" = now()
     WHERE id = $1`,
    [documentId, JSON.stringify(content), contentText, wordCount, charCount, lastEditedById],
  );
}

export async function documentExistsAndNotDeleted(documentId: string): Promise<boolean> {
  const res = await pool.query(`SELECT 1 FROM documents WHERE id = $1 AND "deletedAt" IS NULL`, [documentId]);
  return res.rows.length > 0;
}

const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 dakika

/**
 * Sürüm geçmişi (§8) için periyodik otomatik anlık görüntü. Son otomatik
 * (veya manuel) sürümden bu yana en az 10 dakika geçtiyse ve içerik
 * boş değilse yeni bir `document_versions` satırı ekler. Her
 * onStoreDocument çağrısında (yani her gerçek içerik değişikliğinde)
 * çağrılır ama gerçek bir satır YALNIZCA aralık dolduğunda eklenir —
 * böylece her tuş vuruşunda değil, anlamlı aralıklarla sürüm birikir.
 */
export async function maybeCreateAutoSnapshot(
  documentId: string,
  content: unknown,
  contentText: string,
  editedById: string | null,
): Promise<void> {
  if (!contentText || contentText.trim().length === 0) return;
  if (!editedById) return; // document_versions.createdById NOT NULL — yazan kimliği bilinmiyorsa atlanır

  const last = await pool.query(
    `SELECT "createdAt" FROM document_versions WHERE "documentId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [documentId],
  );
  const lastAt: Date | null = last.rows[0]?.createdAt ?? null;
  if (lastAt && Date.now() - new Date(lastAt).getTime() < AUTO_SNAPSHOT_INTERVAL_MS) return;

  const idRes = await pool.query(
    `SELECT 'docver_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20) AS id`,
  );
  const id = idRes.rows[0].id as string;

  await pool.query(
    `INSERT INTO document_versions (id, "documentId", content, "contentText", label, "isAutoSnapshot", "createdById", "createdAt")
     VALUES ($1, $2, $3, $4, NULL, true, $5, now())`,
    [id, documentId, JSON.stringify(content), contentText, editedById],
  );
}
