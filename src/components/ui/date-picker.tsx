"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO, isValid } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calendarClassNames, calendarComponents } from "@/components/ui/calendar-theme";
import { cn } from "@/lib/utils";

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

// Yerel saat dilimi kaymasından etkilenmeden "yyyy-MM-dd" üretir
// (toISOString() kullanmak UTC'ye çevirdiği için bir gün kayabilir).
function toIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Native `<input type="date">` yerine kullanılan, tamamen tema ile uyumlu
 * tarih seçici. Kullanıcının "tarih böyle görünmesin, temayla orantılı
 * olsun" geri bildirimi üzerine eklendi — native tarayıcı takvimi macOS/
 * Chrome'da stillendirilemeyen OS bileşeni olarak açılıyordu.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Tarih seçin",
  disabled,
  className,
  minDate,
  maxDate,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const minD = parseIsoDate(minDate);
  const maxD = parseIsoDate(maxDate);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-left text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected ? format(selected, "d MMMM yyyy", { locale: tr }) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <DayPicker
          mode="single"
          locale={tr}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDateString(date));
              setOpen(false);
            }
          }}
          disabled={
            minD && maxD
              ? [{ before: minD }, { after: maxD }]
              : minD
                ? { before: minD }
                : maxD
                  ? { after: maxD }
                  : undefined
          }
          showOutsideDays
          classNames={calendarClassNames}
          components={calendarComponents}
        />
      </PopoverContent>
    </Popover>
  );
}
