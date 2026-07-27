# Follow-Up — İş Takip ve Proje Yönetim Sistemi

Takımlar için yapay zeka destekli, Kanban tabanlı iş takip ve proje yönetim sistemi.

## Teknolojiler

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS 4**
- **PostgreSQL** + **Prisma ORM**
- **Auth.js (NextAuth v5)** — e-posta/şifre ile kimlik doğrulama
- **OpenAI API** — doğal dilden görev üretme ve proje özetleme
- **Docker / Docker Compose**

## Özellikler

- **Takımlar & yetkilendirme**: Takım oluşturma, e-posta ile üye davet etme, Yönetici/Üye rolleri.
- **Proje & görev yönetimi**: Kanban panosu (Yapılacak / Devam Ediyor / İncelemede / Tamamlandı), sürükle-bırak ile durum değiştirme, öncelik, son tarih, atama, alt görevler, yorumlar.
- **Aktivite akışı & bildirimler**: Takım içi aktivite kaydı, görev atama/yorum bildirimleri.
- **Yapay zeka**: Doğal dilde yazılan bir isteği görev listesine dönüştürme, proje için yönetici özeti oluşturma (OpenAI API).

## Yerel Geliştirme (Docker ile — önerilen)

1. `.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun (özellikle `POSTGRES_PASSWORD`, `AUTH_SECRET`, `OPENAI_API_KEY`).

   ```bash
   cp .env.example .env
   ```

   `AUTH_SECRET` üretmek için:

   ```bash
   openssl rand -base64 32
   ```

2. Servisleri başlatın:

   ```bash
   docker compose up --build
   ```

   Bu komut sırasıyla: PostgreSQL'i ayağa kaldırır, `migrate` servisi ile Prisma migration'larını uygular, ardından `app` servisini `http://localhost:3000` üzerinde başlatır.

3. (Opsiyonel) Örnek veriyle başlamak için:

   ```bash
   docker compose run --rm migrate npx tsx prisma/seed.ts
   ```

   Bu, `demo@follow-up.local` / `password123` bilgileriyle giriş yapılabilecek bir demo takım ve proje oluşturur.

## Yerel Geliştirme (Docker olmadan)

1. Yerel bir PostgreSQL veritabanı oluşturun ve `.env` dosyasındaki `DATABASE_URL` içindeki `postgres` host adını `localhost` ile değiştirin.
2. Bağımlılıkları kurun (bu adım `postinstall` ile otomatik olarak `prisma generate` çalıştırır):

   ```bash
   npm install
   ```

3. Migration'ları uygulayın:

   ```bash
   npm run db:migrate
   ```

4. (Opsiyonel) Örnek veri ekleyin:

   ```bash
   npm run db:seed
   ```

5. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

## Proje Yapısı

```
prisma/schema.prisma        Veritabanı şeması
src/lib/                    Prisma istemcisi, Auth.js yapılandırması, AI servis katmanı, izin/aktivite yardımcıları
src/app/api/                REST API uç noktaları (App Router route handler'ları)
src/app/(auth)/             Giriş / kayıt sayfaları
src/app/(app)/              Oturum gerektiren uygulama sayfaları (panel, takımlar, projeler, bildirimler)
src/components/             Yeniden kullanılabilir arayüz bileşenleri
```

## Notlar

- Yapay zeka özellikleri (`/api/ai/*`) `OPENAI_API_KEY` ortam değişkeni tanımlı olmadan çalışmaz; tanımlı değilse ilgili istekler açıklayıcı bir hata döner.
- Takım daveti gönderildiğinde davet edilen kişi sistemde kayıtlı değilse, üyelik yöneticiye bir davet bağlantısı (`/invite/[token]`) olarak gösterilir; bu bağlantı manuel olarak paylaşılmalıdır (sistemde e-posta gönderimi bulunmamaktadır).
- `npx prisma studio` ile veritabanını görsel olarak inceleyebilirsiniz.
