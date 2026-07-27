import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı").max(80),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(72),
});

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(1, "Şifre gerekli"),
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Takım adı en az 2 karakter olmalı").max(80),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

// DATED: gün gezinmeli, tarih bazlı pano (mevcut/varsayılan davranış).
// FIXED: sabit, tarihten bağımsız düz Trello panosu — gün gezinmesi yok,
// tüm görevler her zaman görünür. Proje oluşturma anında seçilir, sonradan
// değiştirilemez (bkz. taskKindEnum ile aynı desen).
export const projectKindEnum = z.enum(["DATED", "FIXED"]);

export const createProjectSchema = z.object({
  name: z.string().min(2, "Proje adı en az 2 karakter olmalı").max(120),
  description: z.string().max(2000).optional().nullable(),
  kind: projectKindEnum.optional(),
  memberIds: z.array(z.string()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  memberIds: z.array(z.string()).optional(),
});

export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
// DATED: gün bazlı, gün gezinmesiyle sadece o günün panosunda görünür.
// FIXED: tarihten bağımsız sabit görev, hangi gün seçilirse seçilsin
// panoda hep görünür. Sadece oluşturma anında seçilir, sonradan değişmez.
export const taskKindEnum = z.enum(["DATED", "FIXED"]);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)");

export const createTaskSchema = z.object({
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  description: z.string().max(5000).optional().nullable(),
  // Görev #318: zengin metin (Tiptap JSON) sürümü — bkz. createCommentSchema
  // ile aynı bodyJson deseni. `description` her zaman düz metin paraleli.
  descriptionJson: z.unknown().optional().nullable(),
  columnId: z.string().optional(),
  priority: taskPriorityEnum.optional(),
  kind: taskKindEnum.optional(),
  // Planlanan tarih — DATED görevlerde belirtilmezse API bugünün tarihini
  // kullanır (entryDate deseniyle aynı mantık, bkz. Announcement/
  // ImportantDate/AtlasProgram). FIXED görevlerde tamamen yok sayılır.
  scheduledDate: dateOnly.optional(),
  dueDate: z.string().datetime().optional().nullable(),
  // Bir görev birden fazla kişiye atanabilir (bkz. görev #196). Boş dizi =
  // atanmamış.
  assigneeIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  descriptionJson: z.unknown().optional().nullable(),
  columnId: z.string().optional(),
  priority: taskPriorityEnum.optional(),
  scheduledDate: dateOnly.optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().int().optional(),
});

// Görev #197: resim/YouTube/PDF eki. Gerçek dosya yüklemesi (UPLOAD) ayrı
// bir multipart/form-data uç noktasından geçer (bkz. attachments/route.ts);
// bu şema yalnızca dış bağlantı (LINK — örn. bir YouTube videosu) eklerken
// kullanılır.
export const createTaskAttachmentLinkSchema = z.object({
  url: z.string().url("Geçerli bir bağlantı girin").max(1000),
  title: z.string().max(200).optional().nullable(),
});

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

// Görevlendirme revizyonu: `body` her zaman düz metin karşılığıdır (arama/
// bildirim için). `bodyJson` doluysa UI onu zengin (kalın/liste/resim)
// olarak render eder. Mention artık metne gömülü belirteç yerine doğrudan
// kullanıcı kimlikleri dizisiyle gönderilir (bkz. görev #200).
export const createCommentSchema = z.object({
  body: z.string().min(1, "Yorum boş olamaz").max(10000),
  bodyJson: z.unknown().optional().nullable(),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateTaskAttachmentSchema = z.object({
  showOnCard: z.boolean(),
});

export const createColumnSchema = z.object({
  name: z.string().min(1, "Sütun adı gerekli").max(60),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  isDoneColumn: z.boolean().optional(),
});

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string()).min(1),
});

export const reorderTasksSchema = z.object({
  columnId: z.string(),
  taskIds: z.array(z.string()),
});

export const createRecurringTemplateSchema = z.object({
  columnId: z.string().min(1, "Sütun seçin"),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  description: z.string().max(5000).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  // Kullanıcı talebi #11: şablonlar artık normal görevler gibi birden fazla
  // kişiye etiketlenebilir (bkz. RecurringTemplateAssignee).
  assigneeIds: z.array(z.string()).optional(),
});

export const updateRecurringTemplateSchema = z.object({
  columnId: z.string().min(1).optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  assigneeIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const aiGenerateTasksSchema = z.object({
  prompt: z.string().min(5, "Lütfen daha ayrıntılı bir açıklama girin").max(4000),
  projectId: z.string(),
});

export const createTagSchema = z.object({
  name: z.string().min(2, "Etiket adı en az 2 karakter olmalı").max(40),
  color: z.string().max(20).optional().nullable(),
});

export const attachTagSchema = z.object({
  tagId: z.string(),
});

/** Bir duyuruda kişi etiketleme (bkz. görev #172) — kategori etiketinden ayrı. */
export const attachAnnouncementMentionSchema = z.object({
  userId: z.string().min(1),
});

/** Bir tarih kaydında kişi etiketleme — AnnouncementMention ile aynı desen. */
export const attachImportantDateMentionSchema = z.object({
  userId: z.string().min(1),
});

/** Bir Atlas programında kişi etiketleme — AnnouncementMention ile aynı desen. */
export const attachAtlasProgramMentionSchema = z.object({
  userId: z.string().min(1),
});

// UPLOAD: sunucuya gerçek bir dosya yüklenir. LINK: yalnızca dış bir
// bağlantı (Google Drive, Dropbox vb.) kaydedilir, sunucuda dosya
// saklanmaz (bkz. FileUploadKind).
export const fileUploadKindEnum = z.enum(["UPLOAD", "LINK"]);

/**
 * POST /api/files, multipart/form-data ile gönderildiği için dosyanın
 * kendisi ayrı işlenir — bu şema yalnızca metadata alanlarını doğrular.
 * LINK türünde title ve externalUrl zorunludur (dosya adı gibi doğal bir
 * geri dönüş yoktur); UPLOAD türünde ikisi de opsiyoneldir (title boşsa
 * listede orijinal dosya adı gösterilir).
 */
export const createFileMetaSchema = z
  .object({
    kind: fileUploadKindEnum.default("UPLOAD"),
    title: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    externalUrl: z.string().url("Geçerli bir bağlantı girin").max(1000).optional().nullable(),
    universityId: z.string().optional().nullable(),
    // Kategori etiketi değil — burada seçilen ekip üyelerine "bu dosya
    // seninle ilgili" bildirimi gönderilir (bkz. FileMention).
    mentionedUserIds: z.array(z.string()).optional(),
  })
  .refine((data) => data.kind !== "LINK" || !!data.externalUrl, {
    message: "Bağlantı türü için geçerli bir URL gerekli.",
    path: ["externalUrl"],
  })
  .refine((data) => data.kind !== "LINK" || !!data.title?.trim(), {
    message: "Bağlantı türü için başlık gerekli.",
    path: ["title"],
  });

export const createUniversitySchema = z.object({
  name: z.string().min(2, "Üniversite adı en az 2 karakter olmalı").max(200),
  city: z.string().max(100).optional().nullable(),
});

export const updateUniversitySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  city: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const recordDailyStatSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
  newUserCount: z.number().int().min(0).max(1_000_000),
  emailVerifiedCount: z.number().int().min(0).max(1_000_000),
  phoneVerifiedCount: z.number().int().min(0).max(1_000_000),
  note: z.string().max(2000).optional().nullable(),
});

export const updateDailyStatSchema = z.object({
  newUserCount: z.number().int().min(0).max(1_000_000).optional(),
  emailVerifiedCount: z.number().int().min(0).max(1_000_000).optional(),
  phoneVerifiedCount: z.number().int().min(0).max(1_000_000).optional(),
  note: z.string().max(2000).optional().nullable(),
});

export const createAnnouncementTypeSchema = z.object({
  name: z.string().min(2, "Tür adı en az 2 karakter olmalı").max(60),
});

export const createAnnouncementSchema = z.object({
  universityId: z.string().min(1, "Üniversite seçin"),
  typeId: z.string().min(1, "Tür seçin"),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
  description: z.string().max(5000).optional().nullable(),
  sourceUrl: z.string().url("Geçerli bir bağlantı girin").max(500).optional().nullable().or(z.literal("")),
});

export const updateAnnouncementSchema = z.object({
  universityId: z.string().min(1).optional(),
  typeId: z.string().min(1).optional(),
  title: z.string().min(2).max(200).optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)").optional(),
  description: z.string().max(5000).optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
});

export const createImportantDateTypeSchema = z.object({
  name: z.string().min(2, "Tür adı en az 2 karakter olmalı").max(60),
});

const dateOnlyOptional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)")
  .optional()
  .nullable()
  .or(z.literal(""));

export const createImportantDateSchema = z.object({
  universityId: z.string().min(1, "Üniversite seçin"),
  typeId: z.string().min(1, "Tür seçin"),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
  // Bitiş tarihi kayıt oluşturulurken çoğu zaman henüz bilinmez, bu yüzden
  // opsiyonel — netleştiğinde bir ekip arkadaşı düzenleyerek ekler.
  date: dateOnlyOptional,
  description: z.string().max(5000).optional().nullable(),
});

export const updateImportantDateSchema = z.object({
  universityId: z.string().min(1).optional(),
  typeId: z.string().min(1).optional(),
  title: z.string().min(2).max(200).optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)").optional(),
  date: dateOnlyOptional,
  description: z.string().max(5000).optional().nullable(),
});

// Enstitüler üniversitelerden bağımsız yönetilir (bkz. Institute modeli) —
// createUniversitySchema/updateUniversitySchema ile birebir aynı desen.
export const createInstituteSchema = z.object({
  name: z.string().min(2, "Enstitü adı en az 2 karakter olmalı").max(200),
});

export const updateInstituteSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const degreeLevelEnum = z.enum(["YUKSEK_LISANS", "DOKTORA"]);

export const createAtlasProgramSchema = z.object({
  instituteId: z.string().min(1, "Enstitü seçin"),
  name: z.string().min(2, "Program adı en az 2 karakter olmalı").max(200),
  degreeLevel: degreeLevelEnum,
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
});

export const updateAtlasProgramSchema = z.object({
  instituteId: z.string().min(1).optional(),
  name: z.string().min(2).max(200).optional(),
  degreeLevel: degreeLevelEnum.optional(),
  isActive: z.boolean().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)").optional(),
});

// ---------------------------------------------------------------------------
// Modül 7 — Günlük Akış
// ---------------------------------------------------------------------------

/** "Günü Tamamla" onayında bırakılan isteğe bağlı kısa not. */
export const completeDailyFlowSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

/** Yöneticinin bir kaydı düzeltirken zorunlu olarak bıraktığı gerekçe/not. */
export const editDailyFlowEntrySchema = z.object({
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  reason: z.string().min(2, "Düzeltme için kısa bir not girin").max(500),
});

/**
 * Yöneticinin, henüz akış başlatmamış (veya geçmiş bir günü boş kalmış) bir
 * kullanıcı için elle bir Günlük Akış kaydı oluşturması (bkz. görev #168 —
 * "kendimi düzenlerken kullanıcıyı düzenleyemiyorum" şikayeti; kayıt hiç
 * yoksa düzenlenecek bir şey olmadığından önce oluşturulabilmesi gerekiyordu).
 */
export const adminCreateDailyFlowEntrySchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  reason: z.string().min(2, "Kayıt oluşturma için kısa bir not girin").max(500),
});

/** Yöneticinin bir kullanıcı için tanımladığı ara hakkı + standart saatler. */
export const dailyFlowUserSettingSchema = z.object({
  maxBreakCount: z.number().int().min(0).max(50).optional().nullable(),
  maxBreakMinutes: z.number().int().min(1).max(600).optional().nullable(),
  maxTotalBreakMinutes: z.number().int().min(1).max(1440).optional().nullable(),
  standardStartMinute: z.number().int().min(0).max(1439).optional().nullable(),
  standardEndMinute: z.number().int().min(0).max(1439).optional().nullable(),
});

/** Yöneticinin Günlük Akış olaylarından hangileri için bildirim alacağı. */
export const dailyFlowNotificationPreferenceSchema = z.object({
  onStart: z.boolean().optional(),
  onBreakStart: z.boolean().optional(),
  onBreakResume: z.boolean().optional(),
  onComplete: z.boolean().optional(),
  onBreakExceeded: z.boolean().optional(),
  onDayLeftOpen: z.boolean().optional(),
  onRecordEdited: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Modül 8 — Ortak Alan
// ---------------------------------------------------------------------------

export const documentAccessLevelEnum = z.enum(["VIEWER", "COMMENTER", "EDITOR", "OWNER"]);
export const documentPermissionSubjectTypeEnum = z.enum(["USER", "TEAM", "ROLE", "EVERYONE"]);
export const documentStatusEnum = z.enum([
  "DRAFT",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BEING_REVISED",
  "PENDING_APPROVAL",
  "APPROVED",
  "READY_TO_PUBLISH",
  "COMPLETED",
  "ARCHIVED",
]);

export const createDocumentFolderSchema = z.object({
  name: z.string().min(1, "Klasör adı gerekli").max(120),
  parentFolderId: z.string().optional().nullable(),
});

export const updateDocumentFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  parentFolderId: z.string().optional().nullable(),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1, "Doküman adı gerekli").max(200),
  description: z.string().max(2000).optional().nullable(),
  typeId: z.string().optional().nullable(),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  // Bir şablondan türetiliyorsa: içerik o şablondan kopyalanır, bu
  // doküman artık şablondan tamamen bağımsızdır (§14).
  templateDocumentId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  typeId: z.string().optional().nullable(),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  status: documentStatusEnum.optional(),
  tagIds: z.array(z.string()).optional(),
  // Şablon sistemi (§14): herhangi bir doküman EDITOR/OWNER tarafından
  // şablona dönüştürülebilir; `isSystemTemplate` yalnızca ADMIN tarafından
  // ayarlanabilir (route içinde kontrol edilir, şema seviyesinde değil).
  isTemplate: z.boolean().optional(),
  templateCategory: z.string().max(80).optional().nullable(),
  isSystemTemplate: z.boolean().optional(),
  // Excel türü dokümanlar için otomatik kayıt (bkz. spreadsheet-editor.tsx):
  // Word dokümanları içeriğini Yjs/collab-server üzerinden ayrı bir yoldan
  // kaydeder (bu alanı KULLANMAZ), Excel dokümanları ise canlı işbirliği
  // olmadığı için tablo verisini (Sheet[]) doğrudan bu uç üzerinden yazar.
  content: z.unknown().optional(),
});

export const grantDocumentPermissionSchema = z.object({
  subjectType: documentPermissionSubjectTypeEnum,
  subjectUserId: z.string().optional().nullable(),
  subjectTeamId: z.string().optional().nullable(),
  subjectRole: z.enum(["ADMIN", "MEMBER"]).optional().nullable(),
  level: documentAccessLevelEnum,
}).refine(
  (data) => {
    if (data.subjectType === "USER") return !!data.subjectUserId;
    if (data.subjectType === "TEAM") return !!data.subjectTeamId;
    if (data.subjectType === "ROLE") return !!data.subjectRole;
    return true;
  },
  { message: "Seçilen paylaşım türü için hedef eksik." },
);

export const createDocumentCommentSchema = z.object({
  body: z.string().min(1, "Yorum boş olamaz").max(5000),
  parentCommentId: z.string().optional().nullable(),
  anchorFrom: z.number().int().min(0).optional().nullable(),
  anchorTo: z.number().int().min(0).optional().nullable(),
  anchorText: z.string().max(500).optional().nullable(),
});

export const updateDocumentCommentSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

export const documentSuggestionTypeEnum = z.enum(["INSERT", "DELETE", "FORMAT", "MOVE"]);

export const createDocumentSuggestionSchema = z.object({
  // İstemci tarafında (Tiptap mark'ıyla aynı anda) üretilen kimlik —
  // editördeki suggestionInsert/suggestionDelete mark'ının suggestionId
  // özniteliğiyle BİREBİR aynı değer olmalıdır ki kabul/red işlemi doğru
  // aralığı bulabilsin (bkz. suggestion-mode-extension.ts).
  id: z.string().min(1).optional(),
  type: documentSuggestionTypeEnum,
  anchorFrom: z.number().int().min(0).optional().nullable(),
  anchorTo: z.number().int().min(0).optional().nullable(),
  originalText: z.string().max(10000).optional().nullable(),
  suggestedText: z.string().max(10000).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export const decideDocumentSuggestionSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
});

export const createDocumentVersionSchema = z.object({
  label: z.string().min(1, "Sürüm adı gerekli").max(120),
});

export const restoreDocumentVersionSchema = z.object({
  versionId: z.string(),
});

export const createApprovalRequestSchema = z.object({
  currentApproverId: z.string().optional().nullable(),
});

export const decideApprovalRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUESTED", "REJECTED", "WITHDRAWN"]),
  note: z.string().max(2000).optional().nullable(),
}).refine(
  (data) => data.decision !== "REVISION_REQUESTED" || !!data.note?.trim(),
  { message: "Revizyon talep ederken açıklama zorunludur.", path: ["note"] },
);

export const createDocumentTypeSchema = z.object({
  name: z.string().min(1, "Tür adı gerekli").max(80),
});

export const documentNotificationPreferenceSchema = z.object({
  onShared: z.boolean().optional(),
  onMentioned: z.boolean().optional(),
  onComment: z.boolean().optional(),
  onApproval: z.boolean().optional(),
  onStatusChange: z.boolean().optional(),
});

export const duplicateDocumentSchema = z.object({
  includeComments: z.boolean().optional(),
  includeTasks: z.boolean().optional(),
  includePermissions: z.boolean().optional(),
  folderId: z.string().optional().nullable(),
  title: z.string().min(1).max(200).optional(),
});

export const createPublicShareLinkSchema = z.object({
  expiresInHours: z.number().int().min(1).max(24 * 90).optional().nullable(),
  password: z.string().min(4).max(100).optional().nullable(),
});

export const createDocumentTaskSchema = z.object({
  title: z.string().min(1, "Görev başlığı gerekli").max(200),
  // Task.projectId/columnId veritabanında ZORUNLUDUR (mevcut Kanban
  // modeli) — Ortak Alan'dan görev oluştururken kullanıcı hangi projeye
  // ekleneceğini seçer (bkz. §139 kararı: "yeni bir görev sistemi
  // oluşturulmamalı", bu yüzden mevcut Proje/Sütun yapısına bağlanılır).
  projectId: z.string().min(1, "Görev için bir proje seçin"),
  columnId: z.string().optional().nullable(),
  documentBlockId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

// Kullanıcı talebi #16: Excel gerçek zamanlı işbirliği — bkz.
// spreadsheet-ops/route.ts. `ops` fortune-sheet'in kendi Op[] tipinde,
// istemcide üretilip aynen saklanır/yayınlanır; sunucu içeriğini
// yorumlamaz (yalnızca bir röle).
export const pushSpreadsheetOpsSchema = z.object({
  ops: z.array(z.unknown()).min(1, "En az bir işlem gerekli"),
});

/** "Şu Anda Burada" / canlı hücre imleci — bkz. lib/spreadsheet-presence.ts */
export const updateSpreadsheetPresenceSchema = z.object({
  sheetId: z.string().min(1),
  row: z.number().int().min(0),
  column: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Modül 9 — Finans Takip
// ---------------------------------------------------------------------------

export const financeRecordTypeEnum = z.enum(["INCOME", "EXPENSE"]);
export const financePaymentMethodEnum = z.enum([
  "CASH",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "AUTOMATIC_PAYMENT",
  "OTHER",
]);
export const financeRecordStatusEnum = z.enum(["PAID", "PENDING", "PARTIALLY_PAID", "CANCELLED"]);
export const financeVisibilityEnum = z.enum([
  "ADMIN_ONLY",
  "OWNER_AND_ADMIN",
  "SPECIFIC_USERS",
  "DEPARTMENT",
  "TEAM",
]);
export const financeRecurrenceFrequencyEnum = z.enum([
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "YEARLY",
  "CUSTOM",
]);

const financeDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)");

// Tutar doğrulaması — sunucu tarafında da mutlaka kontrol edilir (bkz.
// proje talebi §12). Negatif/sıfır/aşırı büyük veya finansal olarak
// anlamsız (>2 ondalık) değerler reddedilir.
const financeAmount = z
  .number()
  .positive("Tutar sıfırdan büyük olmalı")
  .max(999_999_999_999, "Tutar çok büyük")
  .refine((v) => Math.round(v * 100) === v * 100, "Tutar en fazla 2 ondalık basamak içerebilir");

export const createFinanceTransactionSchema = z.object({
  type: financeRecordTypeEnum,
  transactionDate: financeDateOnly,
  amount: financeAmount,
  currencyId: z.string().min(1, "Para birimi seçin"),
  /** Belirtilmezse sunucu güncel kuru kullanır (TRY için her zaman 1). */
  rateToTry: z.number().positive().optional(),
  categoryId: z.string().min(1, "Kategori seçin"),
  description: z.string().max(2000).optional().nullable(),
  personId: z.string().min(1, "Harcamayı/geliri yapan kişiyi seçin"),
  payeeName: z.string().max(200).optional().nullable(),
  paymentMethod: financePaymentMethodEnum.optional().nullable(),
  bankAccount: z.string().max(200).optional().nullable(),
  receiptNumber: z.string().max(100).optional().nullable(),
  status: financeRecordStatusEnum.optional(),
  visibility: financeVisibilityEnum.optional(),
  departmentId: z.string().optional().nullable(),
  visibleUserIds: z.array(z.string()).optional(),
  note: z.string().max(2000).optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  isRecurring: z.boolean().optional(),
  recurrence: z
    .object({
      frequency: financeRecurrenceFrequencyEnum,
      customIntervalDays: z.number().int().positive().optional().nullable(),
      endDate: financeDateOnly.optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const updateFinanceTransactionSchema = createFinanceTransactionSchema.partial();

export const createFinanceCategorySchema = z.object({
  name: z.string().min(1, "Kategori adı gerekli").max(120),
  type: financeRecordTypeEnum,
  parentCategoryId: z.string().optional().nullable(),
});

export const updateFinanceCategorySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  parentCategoryId: z.string().optional().nullable(),
});

export const createFinanceCurrencySchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Para birimi kodu yalnızca büyük harf/rakam/alt çizgi içerebilir"),
  name: z.string().min(1).max(80),
  symbol: z.string().min(1).max(10),
  decimalPlaces: z.number().int().min(0).max(6).optional(),
});

export const updateFinanceCurrencySchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(80).optional(),
  symbol: z.string().min(1).max(10).optional(),
});

export const setFinanceRateSchema = z.object({
  currencyId: z.string().min(1),
  rateToTry: z.number().positive("Kur sıfırdan büyük olmalı"),
});

export const updateFinancePermissionSchema = z.object({
  canViewFinance: z.boolean().optional(),
  canViewOwnRecords: z.boolean().optional(),
  canViewAllRecords: z.boolean().optional(),
  canCreateRecords: z.boolean().optional(),
  canEditOwnRecords: z.boolean().optional(),
  canEditAllRecords: z.boolean().optional(),
  canDeleteRecords: z.boolean().optional(),
  canViewReports: z.boolean().optional(),
  canViewAttachments: z.boolean().optional(),
  canManageCategories: z.boolean().optional(),
  canManageRates: z.boolean().optional(),
});

export const createFinanceRecurringTemplateSchema = z.object({
  type: financeRecordTypeEnum,
  amount: financeAmount,
  currencyId: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().max(2000).optional().nullable(),
  personId: z.string().min(1),
  payeeName: z.string().max(200).optional().nullable(),
  paymentMethod: financePaymentMethodEnum.optional().nullable(),
  bankAccount: z.string().max(200).optional().nullable(),
  visibility: financeVisibilityEnum.optional(),
  departmentId: z.string().optional().nullable(),
  frequency: financeRecurrenceFrequencyEnum,
  customIntervalDays: z.number().int().positive().optional().nullable(),
  startDate: financeDateOnly,
  endDate: financeDateOnly.optional().nullable(),
});

export const updateFinanceRecurringTemplateSchema = createFinanceRecurringTemplateSchema
  .partial()
  .extend({ active: z.boolean().optional() });

// ---------------------------------------------------------------------------
// Modül 10 — Sosyal Medya, İçerik ve SEO Yönetimi
// ---------------------------------------------------------------------------

export const socialPlatformEnum = z.enum(["INSTAGRAM", "LINKEDIN", "TWITTER", "TIKTOK", "FACEBOOK"]);

export const contentStatusEnum = z.enum([
  "IDEA",
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_DESIGN",
  "AWAITING_VIDEO",
  "AWAITING_REVIEW",
  "AWAITING_APPROVAL",
  "REVISION_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "CANCELLED",
  "ARCHIVED",
]);

const shortText = (max: number) => z.string().max(max).optional().nullable();
const stringArray = (max: number) => z.array(z.string().max(max)).optional();
const optionalUrl = z
  .string()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Geçerli bir bağlantı girin")
  .optional()
  .nullable();

export const createSocialContentSchema = z.object({
  brandId: z.string().optional().nullable(),
  platform: socialPlatformEnum,
  /** Platforma göre geçerli değer kümesi ayrıca `isValidSocialContentType()` ile (bkz. lib/content.ts) route içinde doğrulanır — burada yalnızca boş bırakılmadığı kontrol edilir. */
  contentType: z.string().min(1, "İçerik türü seçin").max(60),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  postText: shortText(5000),
  shortDescription: shortText(500),
  longDescription: shortText(5000),
  hashtags: stringArray(60),
  mentionAccounts: stringArray(60),
  location: shortText(200),
  linkUrl: optionalUrl,
  ctaText: shortText(200),
  targetAudience: shortText(300),
  contentGoal: shortText(300),
  campaign: shortText(200),
  keywords: stringArray(60),
  altText: shortText(300),
  scheduledAt: z.string().datetime().optional().nullable(),
  priority: taskPriorityEnum.optional(),
  designerId: z.string().optional().nullable(),
  videoEditorId: z.string().optional().nullable(),
  internalNotes: shortText(3000),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateSocialContentSchema = z.object({
  brandId: z.string().optional().nullable(),
  platform: socialPlatformEnum.optional(),
  contentType: z.string().min(1).max(60).optional(),
  title: z.string().min(2).max(200).optional(),
  postText: shortText(5000),
  shortDescription: shortText(500),
  longDescription: shortText(5000),
  hashtags: stringArray(60),
  mentionAccounts: stringArray(60),
  location: shortText(200),
  linkUrl: optionalUrl,
  ctaText: shortText(200),
  targetAudience: shortText(300),
  contentGoal: shortText(300),
  campaign: shortText(200),
  keywords: stringArray(60),
  altText: shortText(300),
  scheduledAt: z.string().datetime().optional().nullable(),
  publishUrl: optionalUrl,
  priority: taskPriorityEnum.optional(),
  designerId: z.string().optional().nullable(),
  videoEditorId: z.string().optional().nullable(),
  internalNotes: shortText(3000),
  mentionedUserIds: z.array(z.string()).optional(),
  /** Durum geçişleri, sıradan alan güncellemesinden ayrı yetki kontrolüne tabidir (bkz. lib/content.ts assertCanSetContentStatus). */
  status: contentStatusEnum.optional(),
});

export const createSocialContentPerformanceSchema = z.object({
  impressions: z.number().int().min(0).optional().nullable(),
  reach: z.number().int().min(0).optional().nullable(),
  likes: z.number().int().min(0).optional().nullable(),
  comments: z.number().int().min(0).optional().nullable(),
  shares: z.number().int().min(0).optional().nullable(),
  saves: z.number().int().min(0).optional().nullable(),
  linkClicks: z.number().int().min(0).optional().nullable(),
  followerGain: z.number().int().min(0).optional().nullable(),
  videoWatchSeconds: z.number().int().min(0).optional().nullable(),
  engagementRate: z.number().min(0).optional().nullable(),
});

export const seoWorkTypeEnum = z.enum([
  "KEYWORD_RESEARCH",
  "CONTENT_OPTIMIZATION",
  "TECHNICAL_SEO_CHECK",
  "META_TITLE_EDIT",
  "META_DESCRIPTION_EDIT",
  "INTERNAL_LINKING",
  "IMAGE_SEO",
  "URL_EDIT",
  "SCHEMA_WORK",
  "COMPETITOR_ANALYSIS",
  "SEARCH_CONSOLE_CHECK",
  "SITEMAP_CHECK",
  "BROKEN_LINK_CHECK",
  "PAGE_SPEED_CHECK",
  "CONTENT_UPDATE",
  "GEO_OPTIMIZATION",
  "AI_SEARCH_VISIBILITY",
]);

export const createBlogContentSchema = z.object({
  brandId: z.string().optional().nullable(),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  summary: shortText(1000),
  body: z.string().max(50000).optional().nullable(),
  category: shortText(200),
  targetPage: shortText(300),
  slug: shortText(300),
  focusKeyword: shortText(200),
  secondaryKeywords: stringArray(100),
  searchIntent: shortText(200),
  targetAudience: shortText(300),
  metaTitle: shortText(200),
  metaDescription: shortText(500),
  h1: shortText(300),
  headingPlan: shortText(5000),
  internalLinks: stringArray(500),
  externalLinks: stringArray(500),
  sources: stringArray(500),
  schemaType: shortText(100),
  canonicalUrl: optionalUrl,
  indexStatus: shortText(100),
  geoTargetQuestions: stringArray(500),
  geoTargetAiQueries: stringArray(500),
  geoDirectAnswer: shortText(3000),
  geoFaq: shortText(5000),
  geoSourceCredibility: shortText(500),
  geoBrandUsage: shortText(500),
  geoStructuredDataNotes: shortText(3000),
  geoQuotableBlocks: shortText(3000),
  geoFreshnessDate: z.string().datetime().optional().nullable(),
  geoExpertReviewed: z.boolean().optional(),
  geoTrustedSources: stringArray(500),
  wordCount: z.number().int().min(0).optional().nullable(),
  readingTimeMinutes: z.number().int().min(0).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  priority: taskPriorityEnum.optional(),
  editorId: z.string().optional().nullable(),
  internalNotes: shortText(3000),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateBlogContentSchema = createBlogContentSchema.partial().extend({
  publishUrl: optionalUrl,
  seoReviewedById: z.string().optional().nullable(),
  approvedById: z.string().optional().nullable(),
  status: contentStatusEnum.optional(),
});

export const createSeoWorkSchema = z.object({
  brandId: z.string().optional().nullable(),
  workType: seoWorkTypeEnum,
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  targetPage: shortText(300),
  targetUrl: optionalUrl,
  description: shortText(3000),
  findings: shortText(3000),
  actionsTaken: shortText(3000),
  keywords: stringArray(60),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: taskPriorityEnum.optional(),
  internalNotes: shortText(3000),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateSeoWorkSchema = createSeoWorkSchema.partial().extend({
  approvedById: z.string().optional().nullable(),
  status: contentStatusEnum.optional(),
});

export const workCategoryEnum = z.enum([
  "SOCIAL_POST",
  "CONTENT_CREATION",
  "GRAPHIC_DESIGN",
  "VIDEO_EDITING",
  "REELS",
  "STORY",
  "BLOG_POST",
  "SEO_WORK",
  "GEO_WORK",
  "KEYWORD_RESEARCH",
  "COMPETITOR_ANALYSIS",
  "WEBSITE_CONTENT_UPDATE",
  "LANDING_PAGE_EDIT",
  "UNIVERSITY_PROGRAM_DATA_ENTRY",
  "ANNOUNCEMENT_ENTRY",
  "PAGE_CHECK",
  "BUG_CHECK",
  "MODERATION",
  "COMMENT_MANAGEMENT",
  "REPORTING",
  "OTHER",
]);

export const createDailyWorkItemSchema = z.object({
  brandId: z.string().optional().nullable(),
  category: workCategoryEnum,
  platform: socialPlatformEnum.optional().nullable(),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı").max(200),
  description: shortText(3000),
  usedText: shortText(5000),
  hashtags: stringArray(60),
  keywords: stringArray(60),
  postUrl: optionalUrl,
  siteUrl: optionalUrl,
  startedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().int().min(0).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  relatedTaskId: z.string().optional().nullable(),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateDailyWorkItemSchema = createDailyWorkItemSchema.partial().extend({
  status: contentStatusEnum.optional(),
});

export const createDailyWorkReportSchema = z.object({
  date: z.string().datetime().optional(),
  employeeNote: shortText(3000),
  items: z.array(createDailyWorkItemSchema).max(50).optional(),
});

export const updateDailyWorkReportSchema = z.object({
  employeeNote: shortText(3000),
});

export const reviewDailyWorkReportSchema = z.object({
  status: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  managerNote: shortText(3000),
  revisionNote: shortText(3000),
});

// ---------------------------------------------------------------------------
// Modül 10 — 5 içerik türü arasında paylaşılan yorum/revizyon/dosya bağlama
// (bkz. lib/content.ts resolveContentTarget).
// ---------------------------------------------------------------------------

export const createContentCommentSchema = z.object({
  body: z.string().min(1, "Yorum boş olamaz").max(5000),
  parentId: z.string().optional().nullable(),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const updateContentCommentSchema = z.object({
  body: z.string().min(1, "Yorum boş olamaz").max(5000),
});

/** İçerik modülü yetki override'ı — `lib/content-permissions.ts`'teki `ContentPermissionSet` alanlarıyla BİREBİR AYNI (bkz. `updateFinancePermissionSchema` deseni). */
export const updateContentPermissionSchema = z.object({
  canViewModule: z.boolean().optional(),
  canViewAllContent: z.boolean().optional(),
  canViewOwnContent: z.boolean().optional(),
  canViewTeamContent: z.boolean().optional(),
  canCreateContent: z.boolean().optional(),
  canEditOwnContent: z.boolean().optional(),
  canEditAllContent: z.boolean().optional(),
  canDeleteOwnContent: z.boolean().optional(),
  canDeleteAllContent: z.boolean().optional(),
  canApproveContent: z.boolean().optional(),
  canRequestRevision: z.boolean().optional(),
  canScheduleContent: z.boolean().optional(),
  canMarkPublished: z.boolean().optional(),
  canManageBlog: z.boolean().optional(),
  canManageSeo: z.boolean().optional(),
  canManageWebsiteWork: z.boolean().optional(),
  canCreateDailyReport: z.boolean().optional(),
  canApproveDailyReport: z.boolean().optional(),
  canUploadFiles: z.boolean().optional(),
  canDeleteFiles: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canMentionUsers: z.boolean().optional(),
  canViewReports: z.boolean().optional(),
  canManageSettings: z.boolean().optional(),
  canUseAi: z.boolean().optional(),
  canViewAiCosts: z.boolean().optional(),
  canViewActivityLog: z.boolean().optional(),
});

export const createContentRevisionSchema = z.object({
  description: z.string().min(1, "Revizyon açıklaması gerekli").max(3000),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const contentAssetRoleEnum = z.enum([
  "COVER",
  "GALLERY",
  "VIDEO",
  "SCREENSHOT",
  "DOCUMENT",
  "SUBTITLE",
  "OTHER",
]);

export const attachContentAssetSchema = z.object({
  fileUploadId: z.string().min(1, "Dosya seçin"),
  role: contentAssetRoleEnum.optional(),
});

// ---------------------------------------------------------------------------
// Yapay zekâ (Claude) destekli içerik üretimi — bkz. proje talebi §9.
// Üretilen içerik ASLA otomatik yayınlanmaz; her üretim `AiGeneration`
// tablosunda denetlenebilir şekilde loglanır (bkz. lib/content-ai.ts).
// ---------------------------------------------------------------------------

export const aiActionTypeEnum = z.enum([
  "BLOG_TOPIC_SUGGESTION",
  "BLOG_DRAFT",
  "TITLE_ALTERNATIVES",
  "META_TITLE",
  "META_DESCRIPTION",
  "KEYWORD_SUGGESTIONS",
  "CONTENT_OUTLINE",
  "HEADING_STRUCTURE",
  "SOCIAL_POST_TEXT",
  "PLATFORM_REWRITE",
  "INSTAGRAM_HASHTAGS",
  "LINKEDIN_TEXT",
  "TWITTER_TEXT",
  "THREAD_GENERATION",
  "TIKTOK_DESCRIPTION",
  "FACEBOOK_TEXT",
  "CTA_SUGGESTION",
  "SHORTEN",
  "LENGTHEN",
  "PROOFREAD",
  "TONE_CHANGE",
  "SEO_ANALYSIS",
  "GEO_SUGGESTIONS",
  "DUPLICATE_DETECTION",
  "QUALITY_SCORE",
]);

export const generateContentAiSchema = z.object({
  actionType: aiActionTypeEnum,
  /** Kullanıcının girdiği bağlam/istek metni — sabit sistem promptu `lib/content-ai.ts` içinde actionType'a göre belirlenir. */
  input: z.string().min(1, "Bir istek/bağlam metni girin").max(8000),
  socialContentId: z.string().optional().nullable(),
  blogContentId: z.string().optional().nullable(),
});

export const decideContentAiGenerationSchema = z.object({
  decision: z.enum(["ACCEPTED", "EDITED", "REJECTED"]),
  editedOutput: z.string().max(20000).optional().nullable(),
});
