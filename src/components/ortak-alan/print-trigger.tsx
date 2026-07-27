"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * PDF dışa aktarma bu yol üzerinden sağlanır: sunucu tarafında PDF
 * render eden bir kütüphane (ör. Puppeteer/Chromium) eklemek yerine,
 * tarayıcının yerleşik "Yazdır → PDF olarak kaydet" özelliği kullanılır
 * — bu, Docker imajına ağır bir Chromium bağımlılığı eklemeden hem
 * yazdırma hem de PDF ihtiyacını karşılar (bkz. document-export.ts'teki
 * genel not). Sayfa yüklendiğinde otomatik yazdırma diyaloğu açılır;
 * düğüm elle de tetiklenebilir.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      onClick={() => window.print()}
      className="fixed right-6 top-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg print:hidden"
    >
      <Printer className="h-4 w-4" />
      Yazdır / PDF olarak kaydet
    </button>
  );
}
