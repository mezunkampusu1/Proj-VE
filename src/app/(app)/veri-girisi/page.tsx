import { VeriGirisiView } from "@/components/veri-girisi/veri-girisi-view";

/**
 * Veri Girişi: Duyurular ve Tarihler modüllerinin birleşik, sadeleştirilmiş
 * giriş ekranı (bkz. kullanıcı talebi — çalışanlar duyuruları zaten başka
 * bir yerde takip ediyor, buraya sadece Başlık/Üniversite/Tür/Giriş Tarihi
 * girmeleri yeterli olsun). Veri modeli DEĞİŞMEDİ: bu ekran sadece mevcut
 * /api/announcements ve /api/dates uçlarına POST atan basit bir arayüz —
 * Duyurular ve Tarihler sayfaları, raporları ve admin ekranları etkilenmez.
 * Yetkilendirme (app)/layout.tsx içinde zaten yapılıyor; veri erişimi de
 * çağrılan API uçlarının kendi requireTeamMember kontrolüyle sağlanıyor.
 */
export default function VeriGirisiPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Veri Girişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Duyuru ve önemli tarih kayıtlarını tek bir basit formdan girin — Başlık, Üniversite, Tür ve
          Giriş Tarihi yeterli. Çok sayıda kayıt için Excel&apos;den toplu yükleme de yapabilirsiniz.
        </p>
      </div>
      <VeriGirisiView />
    </div>
  );
}
