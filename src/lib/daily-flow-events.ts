"use client";

/**
 * Revizyon: "Günlük akış kısımda ara ver dediğimde veya akışa dön dediğim
 * gibi durumlarda anlık panelde güncellenmiyor f5 atmak gerekiyor." —
 * `DailyFlowCard` (kendi durumunuz) ve `TeamStatusList` (ekibin durumu,
 * dashboard'da hemen altında) birbirinden bağımsız, kendi periyodik
 * zamanlayıcılarıyla veri çeken iki ayrı bileşen. `DailyFlowCard` bir
 * aksiyon (başlat/ara ver/dön/tamamla) sonrası kendini hemen günceller,
 * ama `TeamStatusList` bunu en geç 30 saniyelik kendi döngüsünde fark
 * eder — kullanıcı F5 atmadan aynı anda güncellenmiş göremez.
 *
 * Basit bir `window` olayı ile bu iki bileşen arasında (server'dan geçen
 * bir prop olmadan, sayfa yeniden render edilmeden) anlık haberleşme
 * sağlanır: aksiyon başarılı olur olmaz `emitDailyFlowChanged()` çağrılır,
 * dinleyen her bileşen (şu an yalnızca TeamStatusList) kendi verisini
 * hemen yeniden çeker.
 */
const EVENT_NAME = "daily-flow-changed";

export function emitDailyFlowChanged() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function onDailyFlowChanged(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}
