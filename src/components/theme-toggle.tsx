"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Açık/koyu mod anahtarı — kayan daireli, ikonlu bir switch (bkz. proje
 * talebi: "dark mode seçimli açık mod seçimli ... aşırı şık"). AppShell
 * üst barında, bildirim zilinin yanında yaşar.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Açık moda geç" : "Koyu moda geç"}
      title={isDark ? "Açık moda geç" : "Koyu moda geç"}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-secondary/70 px-1.5 transition-colors hover:bg-secondary"
    >
      <Sun className={cn("h-3.5 w-3.5 shrink-0 text-amber-500 transition-opacity", isDark && "opacity-30")} />
      <Moon
        className={cn(
          "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity",
          isDark && "text-tint-violet-foreground opacity-100",
          !isDark && "opacity-30",
        )}
      />
      <span
        className={cn(
          "absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-foreground shadow-[var(--shadow-card)] transition-all duration-200 ease-out",
          isDark ? "left-[26px]" : "left-0.5",
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
      </span>
    </button>
  );
}
