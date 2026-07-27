"use client";

import { useEffect, useRef } from "react";

/**
 * Projede modül modül tekrarlanan "periyodik tazeleme + pencere odağına/
 * sekme görünürlüğüne dönünce hemen tazeleme" deseninin (bkz. kanban-board.tsx,
 * notification-bell.tsx, daily-flow-card.tsx, user-reports-view.tsx — hepsi
 * aynı setInterval + visibilitychange + focus üçlüsünü elle kopyalıyordu)
 * ortak, tek yerden yönetilen hâli. Kullanıcı talebi: "F5 atmadan güncel
 * görünme" ihtiyacı artık her ekranda ayrı ayrı elle yazılmak yerine bu
 * hook'tan sağlanıyor — Duyurular, Tarihler, Atlas, Dosyalar, Finans,
 * Sosyal Medya & İçerik, Veri Girişi ve Görev notları gibi daha önce hiç
 * canlı güncellenmeyen ekranlara da aynı tutarlı davranışı kazandırır.
 *
 * @param callback Her tetiklemede çağrılacak fonksiyon (genelde bir fetch/liste yükleme).
 * @param intervalMs Polling aralığı (ms).
 * @param enabled false ise hiçbir tetikleyici çalışmaz — örn. bir sürükleme
 *   veya aktif düzenleme sürerken dıştan gelen veriyle üzerine yazılmasın diye.
 */
export function useLiveRefresh(callback: () => void, intervalMs: number, enabled: boolean = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => callbackRef.current(), intervalMs);
    function onVisible() {
      if (document.visibilityState === "visible") callbackRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled]);
}
