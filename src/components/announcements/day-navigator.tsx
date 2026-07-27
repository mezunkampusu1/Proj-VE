"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import { calendarClassNames, calendarComponents } from "@/components/ui/calendar-theme";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIso() {
  return toIsoDateString(new Date());
}

/**
 * Duyurular > Günlük Takip için gün gezinme çubuğu. Ekip günde onlarca
 * duyuru girdiğinde tüm günleri tek bir uzun listede aşağı kaydırmak yerine
 * her seferinde tek bir günü gösterip önceki/sonraki gün oklarıyla veya
 * takvimden seçilen bir tarihe atlayarak gezinmeyi sağlar.
 */
export function DayNavigator({
  value,
  onChange,
  count,
  countLabel = "duyuru",
}: {
  value: string;
  onChange: (value: string) => void;
  count?: number;
  countLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const isTodaySelected = value === todayIso();

  function shift(days: number) {
    onChange(toIsoDateString(addDays(selected, days)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-md border border-input bg-secondary/40">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Önceki gün"
          className="flex h-9 w-9 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 min-w-[190px] items-center justify-center gap-2 border-x border-input px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {isValid(selected) ? format(selected, "d MMMM yyyy, EEEE", { locale: tr }) : "Tarih seçin"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center">
            <DayPicker
              mode="single"
              locale={tr}
              selected={isValid(selected) ? selected : undefined}
              defaultMonth={isValid(selected) ? selected : undefined}
              onSelect={(date) => {
                if (date) {
                  onChange(toIsoDateString(date));
                  setOpen(false);
                }
              }}
              showOutsideDays
              classNames={calendarClassNames}
              components={calendarComponents}
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Sonraki gün"
          className="flex h-9 w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChange(todayIso())}
        className={cn(
          "h-9 rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-secondary",
          isTodaySelected ? "border-primary/50 text-primary" : "text-muted-foreground",
        )}
      >
        Bugün
      </button>

      {typeof count === "number" && <Badge tone="slate">{count} {countLabel}</Badge>}
    </div>
  );
}
