# Mezun Kampüsü Operasyon Sistemi — Mimari Doküman

Bu doküman, `follow-up-system` projesinin çok modüllü, uzun ömürlü bir operasyon
sistemine dönüştürülmesi için mimari kararları, veri modelini ve geliştirme yol
haritasını içerir. Yeni bir modül eklenmeden önce bu doküman güncellenmelidir —
sistemin "tek kaynak" (source of truth) mimari referansı budur.

## 1. Temel Prensipler

- **Mevcut altyapı korunur.** Auth.js (credentials), PostgreSQL/Prisma, Docker
  Compose altyapısı değişmeden kalır. Sadece genişletilir.
- **Tek çalışma alanı (single workspace).** Sistem çoklu takım/organizasyon
  desteği sunmaz. Mevcut `Team`/`TeamMember` modelleri korunur (şema kırılımı
  yaratmamak için kaldırılmaz) ama ürün seviyesinde sistem ilk kurulumda tek
  bir "Mezun Kampüsü" çalışma alanını otomatik oluşturur. `TeamRole.ADMIN` →
  **Yönetici**, `TeamRole.MEMBER` → **Ekip Üyesi** olarak eşlenir.
- **Modüler, özellik bazlı klasörleme.** Yeni modüller `src/features/<modül>/`
  altında; her modülün kendi `components/`, `actions.ts` (server actions),
  `queries.ts` (veri okuma), `types.ts` dosyaları olur. `src/app/**` yalnızca
  route/sayfa iskeletini barındırır, iş mantığını `src/features/**`'e
  devreder. Bu yapı, yıllar içinde modül sayısı arttıkça dosya karmaşasını
  önler.
- **Ortak çekirdek (`src/core` veya mevcut `src/lib`).** Prisma client, Auth.js,
  yetkilendirme, denetim kaydı (audit log), dosya depolama gibi tüm modüllerin
  paylaştığı altyapı burada yaşar.
- **Kırılmazlık.** Her modül bağımsız migration'larla eklenir; mevcut
  tablolara sadece **nullable/ek** kolonlar eklenir, var olan alanlar
  silinmez/tipleri değiştirilmez.
- **Onay kapıları.** Her modül: (1) şema migration'ı, (2) ekran(lar),
  (3) test + `docker compose build` doğrulaması tamamlanmadan bir sonrakine
  geçilmez.

## 2. Tasarım Sistemi

- **Shadcn/UI** bileşenleri projeye kopyalanır (`src/components/ui/*`),
  mevcut el yapımı bileşenlerin (`button.tsx`, `input.tsx` vb.) yerini alır.
  Shadcn'in standart ekosistem bağımlılıkları da bu kapsamda eklenecek:
  `class-variance-authority`, `tailwind-merge`, `lucide-react` (ikonlar),
  `@radix-ui/*` (erişilebilir primitive'ler), `recharts` (dashboard
  grafikleri için shadcn'in resmi chart bileşeni bunu kullanır),
  `@tanstack/react-table` (veri tabloları için shadcn DataTable deseni),
  `react-day-picker` (tarih seçiciler), `sonner` (toast bildirimleri).
  Bunların hepsi "Shadcn/UI kullan" talimatının doğal parçası; ayrıca bir
  onay istemiyorum ama şeffaf olmak için burada listeliyorum.
- **Varsayılan tema: Dark.** `<html class="dark">`, CSS değişkenleriyle
  (`--background`, `--foreground`, `--card`, `--primary`, `--muted`,
  `--border` vb.) koyu, premium SaaS paleti. Açık tema daha sonra istenirse
  `next-themes` ile eklenebilir (şimdilik kapsam dışı).
- **Layout kabuğu:** Ekran görüntüsündeki gibi sabit sol sidebar (Dashboard,
  Kullanıcı Raporları, Duyurular, Tarihler, Atlas, Dosyalar, Görevler,
  Ayarlar), üstte arama + bildirim + profil menüsü. Sağdan açılan `Sheet`
  (drawer) ile detay panelleri (görev/duyuru detayı ekran görüntüsündeki gibi).
- **Bileşen tekrar kullanımı:** `DataTable`, `FilterBar`, `TagPicker`,
  `EntityDetailSheet`, `StatCard`, `ActivityFeed` gibi jenerik bileşenler
  `src/components/shared/` altında yazılır ve tüm modüller bunları kullanır.

## 3. Veritabanı Şeması (yeni modeller)

Mevcut modeller (`User`, `Team`, `TeamMember`, `Project`, `Task`, `SubTask`,
`TaskComment`, `Notification`, `ActivityLog`) korunur. Aşağıdakiler eklenir:

### 3.1 Ortak Etiket Sistemi (Modül 4 — diğer modüllerin temeli)
```
Tag            id, name, slug (unique), color, createdAt
AnnouncementTag   announcementId, tagId
ImportantDateTag  importantDateId, tagId
TaskTag           taskId, tagId
AtlasProgramTag   atlasProgramId, tagId
```
Polimorfik tek tablo yerine modül başına açık join tabloları kullanılır —
tip güvenliği ve sorgu performansı için (Prisma'da polimorfik ilişki yerine
önerilen yaklaşım).

### 3.2 Üniversite (tüm modüllerin referans verisi)
```
University   id, name, city, slug (unique), isActive, createdAt
```
Excel içe aktarma: `/api/universities/import` uç noktası bir `.xlsx` dosyasını
satır satır okuyup `University` kayıtları oluşturur/günceller (isim eşleşmesine
göre upsert), sonucu (kaç eklendi/güncellendi/hata) döner.

### 3.3 Modül 1 — Kullanıcı Raporları
```
DailyUserStat   id, date (unique), newUserCount, emailVerifiedCount,
                phoneVerifiedCount, recordedById, createdAt, updatedAt
```

### 3.4 Modül 2 — Duyurular
```
AnnouncementType  id, name, slug (unique)   // Sempozyum, Kongre, Öğrenci Alımı...
Announcement      id, universityId, typeId, title, description, sourceUrl,
                   createdById, createdAt, updatedAt
                   + tags (AnnouncementTag üzerinden)
```

### 3.5 Modül 3 — Tarihler
```
ImportantDate   id, universityId, title, startDate, endDate, applicationDate,
                 resultDate, description, createdById, createdAt, updatedAt
                 + tags (ImportantDateTag üzerinden)
```

### 3.6 Modül 5 — Atlas
```
Institute        id, universityId, name, createdAt
AtlasProgram     id, instituteId, name, degreeLevel (YUKSEK_LISANS|DOKTORA),
                  isActive, createdById, createdAt, updatedAt
                  + tags (AtlasProgramTag üzerinden)
AtlasChangeLog   id, programId, action (CREATED|UPDATED|REMOVED), field,
                  oldValue, newValue, changedById, changedAt
```
Her `AtlasProgram` güncellemesinde değişen alanlar otomatik `AtlasChangeLog`'a
yazılır (Prisma `$extends` client-extension ile merkezi olarak, modül bazlı
tekrar yazılmadan).

### 3.7 Modül 6 — Dosyalar
```
FileUpload   id, universityId (nullable), fileName, storedPath, fileSize,
              mimeType, uploadedById, createdAt
```
Depolama: Docker named volume (`uploads_data:/app/uploads`), dosyalar
`/api/files/[id]/download` üzerinden oturum + yetki kontrolüyle sunulur
(doğrudan `/public` üzerinden **değil** — herkese açık olmaması için).

### 3.8 Modül 7 — Günlük Görevler (mevcut Kanban'ın genişletilmesi)
Zaten var olan `Task` modeline eklenecekler:
```
Task.tags        (TaskTag üzerinden, yeni)
TaskAttachment    id, taskId, fileName, storedPath, fileSize, uploadedById,
                   createdAt   (FileUpload ile aynı depolama mekanizması)
```
Kolon adları arayüzde: Yapılacak / Devam Ediyor / **Kontrol Edilecek** /
Tamamlandı (mevcut `IN_REVIEW` durumunun görünen adı güncellenecek, veri
modeli değişmeyecek — kırılmaz değişiklik).

### 3.9 Denetim Kaydı (İşlem Geçmişi) genişletmesi
Mevcut `ActivityLog` tablosuna eklenir:
```
ActivityLog.ipAddress   String?  (yeni)
ActivityLog.module      enum ModuleName (TASKS|ANNOUNCEMENTS|DATES|ATLAS|
                          FILES|USER_REPORTS|TEAM)  (yeni)
```
Her yeni modül kendi nullable foreign key'ini ekler (ör. `announcementId`,
`importantDateId` vb.) — tek tabloda birleşik, filtrelenebilir bir akış elde
edilir. Yönetici panelinde "Bugün kim ne yaptı" ekranı bu tabloyu
`module`/`userId`/`date` bazında gruplar.

## 4. Yetkilendirme Modeli

- **Yönetici (ADMIN):** Tüm modüllere tam erişim, raporlama/denetim
  ekranlarını görür, üye yönetimi yapar.
- **Ekip Üyesi (MEMBER):** Kendi girdiği verileri düzenleyebilir, atanan
  görevleri yönetebilir; yönetici raporlama ekranlarını göremez.
- Yetki kontrolü mevcut `requireTeamMember`/`requireTeamAdmin` yardımcıları
  üzerinden, modül bazlı sarmalayıcılarla (`requireModuleAccess`) genişletilir.

## 5. Dashboard (Yönetici Paneli)

`StatCard` bileşenleriyle: bugünkü yeni kullanıcı/duyuru/tarih/atlas
güncelleme/dosya/tamamlanan görev sayıları; `recharts` ile son 30 günün
trend grafiği; bekleyen ve geciken görevler listesi. Tüm veriler ilgili
modül tablolarından tarih bazlı `groupBy` sorgularıyla hesaplanır (ayrı bir
"özet" tablosu tutulmaz — kaynak veri tek doğruluk kaynağıdır).

## 6. Geliştirme Yol Haritası (onay kapılı)

| Faz | Kapsam | Çıktı |
|---|---|---|
| **Faz 0** | Tasarım sistemi geçişi (shadcn + dark tema + yeni layout kabuğu), tüm yeni modellerin Prisma migration'ı, ortak `Tag`/`University`/audit-log genişlemesi | Mevcut ekranlar shadcn ile çalışır durumda, yeni tablolar veritabanında hazır, build/test geçer |
| **Faz 1** | Modül 4 (Etiketler) + Modül 6 (Dosyalar) — diğer modüllerin bağımlı olduğu temel yapı taşları | Etiket yönetimi ekranı, dosya yükleme/indirme akışı |
| **Faz 2** | Üniversite yönetimi + Excel içe aktarma | Üniversite listesi ekranı, import akışı |
| **Faz 3** | Modül 1 — Kullanıcı Raporları | Günlük veri girişi + dashboard grafiği |
| **Faz 4** | Modül 2 — Duyurular | CRUD + yönetici raporlama görünümü |
| **Faz 5** | Modül 3 — Tarihler | CRUD + raporlama |
| **Faz 6** | Modül 5 — Atlas | Üniversite > Enstitü > Program hiyerarşisi + değişiklik geçmişi |
| **Faz 7** | Modül 7 genişletmesi | Task'lara etiket + dosya eki, kolon adı güncellemesi |
| **Faz 8** | Yönetici Paneli + İşlem Geçmişi ekranı | Tüm modülleri özetleyen dashboard, filtrelenebilir audit log ekranı |

Her fazın sonunda: migration + build + kısa manuel test → onayınız → sıradaki
faz.

## 7. Açık Kararlar / Varsayımlar

- Dosya depolama yerel Docker volume ile yapılacak (S3 vb. bulut depolama şu
  an kapsam dışı; ileride tek bir soyutlama katmanıyla değiştirilebilir).
- Çoklu takım desteği ürün seviyesinde kapatılacak ama veri modelinde
  kalacak (ileride ihtiyaç olursa yeniden açılabilir).
- E-posta gönderimi hâlâ yok (davet linki paylaşımı mevcut yöntemle devam
  eder).
