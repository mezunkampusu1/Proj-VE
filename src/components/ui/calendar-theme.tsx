import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ClassNames } from "react-day-picker";

/**
 * `react-day-picker` için tema uyumlu ortak `classNames` haritası.
 * `DatePicker` (src/components/ui/date-picker.tsx) ve `DayNavigator`
 * (src/components/announcements/day-navigator.tsx) aynı görünümü kullanır;
 * kopya kod yerine burada tek noktadan yönetilir.
 */
export const calendarClassNames: Partial<ClassNames> = {
  months: "flex flex-col",
  month: "space-y-2",
  nav: "flex items-center justify-between mb-1",
  button_previous:
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
  button_next:
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
  month_caption: "flex h-8 items-center justify-center text-sm font-medium text-foreground",
  caption_label: "text-sm font-medium",
  month_grid: "mt-1 w-full border-collapse",
  weekdays: "flex",
  weekday: "w-8 text-center text-[0.7rem] font-normal text-muted-foreground",
  week: "mt-1 flex w-full",
  day: "relative h-8 w-8 p-0 text-center text-sm",
  day_button:
    "h-8 w-8 rounded-md text-sm font-normal text-foreground/90 transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring",
  selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
  today: "[&>button]:border [&>button]:border-primary/60",
  outside: "[&>button]:text-muted-foreground/40",
  disabled:
    "[&>button]:cursor-not-allowed [&>button]:text-muted-foreground/30 [&>button]:opacity-40 [&>button]:hover:bg-transparent",
  hidden: "invisible",
};

export const calendarComponents = {
  Chevron: ({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) =>
    orientation === "left" ? (
      <ChevronLeft className="h-4 w-4" />
    ) : (
      <ChevronRight className="h-4 w-4" />
    ),
};
