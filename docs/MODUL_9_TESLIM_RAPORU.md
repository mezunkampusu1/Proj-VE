# Modül 9 — Sosyal Medya, İçerik ve SEO Yönetimi — Teslim Raporu

Tarih: 2026-07-20

## 1. Yeni Sayfalar

| Yol | Açıklama |
|---|---|
| `/content` | Genel Bakış — dashboard, modül özet kartları |
| `/content/calendar` | İçerik Takvimi (tüm içerik türleri) |
| `/content/inbox` | Onay Bekleyenler / Bana Atananlar / Medya Arşivi / Aktivite Geçmişi (sekmeli) |
| `/content/social` | Sosyal medya içerikleri (5 platform, dinamik içerik türleri) |
| `/content/blog` | Blog & SEO/GEO içerikleri |
| `/content/seo` | SEO çalışmaları |
| `/content/website-work` | Site içi çalışmalar |
| `/content/daily-reports` | Günlük çalışma raporları (gönderim + onay/revizyon akışı) |
| `/content/reports` | Raporlama & performans + CSV dışa aktarma |
| `/content/settings` | (yalnızca ADMIN) Marka/proje yönetimi + kullanıcı bazlı yetki override paneli |

## 2. Yeni Prisma Modelleri (tek migration: `20260720115719_social_content_seo_module`)

`ContentBrand`, `ContentPermission`, `SocialContent`, `SocialContentPerformance`, `BlogContent`, `SeoWork`, `WebsiteWork`, `DailyWorkReport`, `DailyWorkItem`, `ContentComment`, `ContentCommentMention`, `ContentMention`, `ContentRevision`, `ContentAsset`, `AiGeneration` — artı `SocialPlatform`, `ContentStatus`, `WorkCategory`, `SeoWorkType`, `WebsiteWorkType`, `DailyWorkReportStatus`, `ContentRevisionStatus`, `ContentAssetRole`, `AiActionType`, `AiOutputDecision` enumları.

Bu pencerede yeni migration gerekmedi — şema önceki fazda (`Şema tasarımı + migration`, task #289) tamamlanmıştı; bu oturumda yalnızca API/UI eklendi.

## 3. Uç Noktalar (`/api/content/**`)

CRUD: `social`, `blog`, `seo`, `website-work`, `daily-reports` (+ `items`, `review`), `brands`, `permissions`.
Ortak: `[kind]/[contentId]/comments`, `.../revisions`, `.../assets`.
Toplu görünümler: `pending-approval`, `assigned-to-me`, `media-archive`, `calendar`, `summary`, `reports`, `activity-log`.
Performans: `social/[contentId]/performance` (upsert).
AI scaffold: `ai`, `ai/generate`, `ai/[generationId]`.

## 4. Yetkilendirme

Mevcut `TeamRole` (ADMIN/MEMBER) tek otorite olarak kullanıldı; ADMIN her zaman tüm yetkilere sahip. `ContentPermission` tablosu yalnızca MEMBER'lar için 27 alanlık ince taneli override tanımlar (görüntüleme/oluşturma/düzenleme/silme/onay/zamanlama/yayın/alt-modül yönetimi/yorum/etiketleme/rapor/ayar/AI/aktivite geçmişi). Yönetim ekranı: `/content/settings` → Yetkiler sekmesi (Finans modülündeki `PermissionsManager` deseniyle birebir).

## 5. Bu Pencerede Değiştirilen/Eklenen Dosyalar (Faz 16-17: Ayarlar + Aktivite Geçmişi)

**Yeni:**
- `src/app/api/content/permissions/route.ts`, `src/app/api/content/permissions/[userId]/route.ts`
- `src/app/api/content/activity-log/route.ts`
- `src/components/content/content-admin-panel.tsx` (Yetkiler + Markalar sekmeleri)
- `src/components/content/content-activity-log-view.tsx`
- `src/app/(app)/content/settings/page.tsx`

**Değiştirilen:**
- `src/lib/validations.ts` — `updateContentPermissionSchema` eklendi
- `src/components/layout/app-shell.tsx` — "Ayarlar" nav linki (yalnızca ADMIN)
- `src/components/content/content-inbox-view.tsx`, `src/app/(app)/content/inbox/page.tsx` — "Aktivite Geçmişi" sekmesi (`canViewActivityLog` yetkisine bağlı)

## 6. Bildirimler

`CONTENT_MENTIONED`, `CONTENT_ASSIGNED`, `CONTENT_COMMENT`, `CONTENT_REVISION_REQUESTED`, `CONTENT_APPROVED`, `CONTENT_REJECTED`, `CONTENT_PUBLISH_REMINDER`, `CONTENT_DEADLINE_REMINDER`, `DAILY_WORK_REPORT_APPROVED`, `DAILY_WORK_REPORT_REVISION` — önceki fazda (`Bildirim entegrasyonu`, task #295) tamamlandı, bu pencerede değişiklik yok.

## 7. AI Scaffold

`src/lib/content-ai.ts` — Claude API çağrı katmanı (üretim/maliyet hesaplama). Ortam değişkenleri: `ANTHROPIC_API_KEY` (zorunlu, yoksa AI özellikleri devre dışı kalır), `ANTHROPIC_MODEL` (opsiyonel, varsayılan tanımlı), `ANTHROPIC_INPUT_PRICE_PER_MTOK` / `ANTHROPIC_OUTPUT_PRICE_PER_MTOK` (opsiyonel, maliyet gösterimi için).

## 8. Testler

Bu projede otomatik test paketi (jest/vitest vb.) yok; doğrulama iki adımlı statik kontrolle yapıldı:

- **Sözdizimi:** `npx esbuild <dosya> --platform=node --jsx=automatic --outfile=/tmp/out.js` — her yeni/değişen dosya için ayrı ayrı, hepsi temiz.
- **Tip kontrolü:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "is missing in type|Property .* is missing|Argument of type|is not assignable to type" | grep -v "prisma/client|@prisma"` — proje genelinde çalıştırıldı, tek sonuç `src/app/api/documents/[documentId]/route.ts(152,11)` — Modül 9 ile **ilgisiz, önceden var olan** bir hata (Ortak Alan/Dokümanlar modülünde).

Sandbox'ta Prisma CLI (`generate`/`migrate`) offline çalışmadığından gerçek `next build`/Docker derlemesi burada koşulamadı; bu adım kullanıcının kendi makinesinde yapılmalı (bkz. §11).

## 9. Bilinen Sınırlamalar / Dikkat Edilmesi Gerekenler

1. **Medya Arşivi indirme izin sınırı:** `/content/inbox` → Medya Arşivi sekmesinde görünen bir dosya, gerçek indirme sırasında `/api/files/[fileId]/download` uç noktasının KENDİ kuralına (yükleyen/etiketlenen/ADMIN) tabidir — içerik modülü görünürlüğünü tanımaz. Yani bir kullanıcı içerik izinleri sayesinde bir eki Medya Arşivi'nde görebilir ama indirme linkinde 403 alabilir. Kapsam dışı bırakıldı (Dosyalar modülünün ayrı sözleşmesine dokunmayı gerektiriyor); ileride birleştirilmesi önerilir.
2. **Buton varyantı hatası (düzeltildi):** Geliştirme sırasında 8 dosyada (`daily-report-list/modal`, `website-work-list`, `content-calendar`, `seo-work-list`, `social-content-list`, `media-archive-list`, `blog-content-list`) var olmayan `variant="outline"` kullanılmıştı — `Button` bileşeni yalnızca `primary/secondary/ghost/danger` destekliyor. Tespit edilip `secondary`'ye çevrildi, proje genelinde yeniden doğrulandı.
3. Nav'daki "Ayarlar" (Modül 9) ile genel "Ayarlar" (`/settings`) aynı ikonu (Settings) kullanıyor ama farklı gruplarda oldukları için karışıklık beklenmiyor.
4. Modülle ilgisiz, bekleyen tek görev: "Kullanıcılar sayfasından Günlük Akış panelini kaldır" (task #229) — bu teslimatın kapsamı dışında, ayrıca istenmedikçe dokunulmadı.

## 10. Manuel Test Alanları (kullanıcı tarafından)

- ADMIN olarak `/content/settings` → Yetkiler sekmesinde bir MEMBER'a override tanımlayıp sıfırlamayı deneyin.
- Aynı ekranda Markalar sekmesinden yeni marka ekleyip pasife alın; sosyal medya formunda seçilebildiğini doğrulayın.
- Bir MEMBER'a `canViewActivityLog` yetkisi verip `/content/inbox` → Aktivite Geçmişi sekmesinin göründüğünü, yetkisiz bir MEMBER'da görünmediğini doğrulayın.
- Yayınlanmış bir sosyal medya içeriğine performans verisi girip Raporlama ekranındaki toplamların güncellendiğini kontrol edin.
- Medya Arşivi'nde etiketlenmemiş bir kullanıcı için indirme linkinin 403 verebileceğini (bkz. §9.1) göz önünde bulundurun.

## 11. Dağıtım (Docker rebuild)

Şema/paket değişikliği olduğundan (bu modülün önceki fazlarında), test ortamına almadan önce tam yeniden derleme gerekir:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

Gerekli ortam değişkenleri (yeni): `ANTHROPIC_API_KEY` (AI özellikleri için — yoksa AI kapalı kalır, modülün geri kalanı etkilenmez).
