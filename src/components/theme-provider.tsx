"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

/**
 * Açık/koyu tema sağlayıcısı — `next-themes` üzerine ince bir sarmalayıcı.
 * Daha önce burada elle yazılmış bir çözüm vardı (localStorage + engelleyici
 * script); kullanıcı geri bildirimi üzerine ("F5'te hep dark'a dönüyor")
 * kanıtlanmış, App Router'daki hydration/FOUC tuzaklarını doğru ele alan
 * `next-themes` kütüphanesine taşındı. `attribute="class"` ile `<html>`
 * üzerinde `dark` sınıfını yönetir — globals.css'teki `:root`/`.dark` bloğu
 * ile birebir uyumlu. `enableSystem`, hiç seçim yapılmamışsa işletim
 * sistemi tercihini kullanır; kullanıcı bir kez seçtiğinde o tercih
 * `localStorage`'da (`follow-up-theme`) kalıcı olur.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="follow-up-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * `next-themes`'in `useTheme`'ini sarmalar: `resolvedTheme` (mount öncesi
 * `undefined` olabilir) yerine her zaman "light"/"dark" döner — sunucu
 * tarafı ve mount öncesi durum güvenli şekilde "dark" varsayar (bkz.
 * layout.tsx'teki SSR fallback), böylece tüketen bileşenler (ThemeToggle,
 * Toaster) hydration uyuşmazlığı riski taşımadan kullanabilir. Ayrıca tek
 * tıkla geçiş için `toggleTheme` ekler.
 */
export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const theme: "light" | "dark" = resolvedTheme === "light" ? "light" : "dark";

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggleTheme };
}
