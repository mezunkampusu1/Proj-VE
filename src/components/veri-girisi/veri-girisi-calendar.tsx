"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface CalendarItem {
  id: string;
  kind: "ANNOUNCEMENT" | "DATE";
  title: string;
  universityName: string;
  typeName: string;
  createdByName: string;
}

interface CalendarDay {
  date: string;
  count: number;
  items: CalendarItem[];
}

interface CalendarResponse {
  days: CalendarDay[];
  total: number;
}

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ayın haftalarını (Pazartesi başlangıçlı, tam haftalar) döner — bkz. content-calendar.tsx ile aynı desen. */
function buildWeeks(monthDate: Date): Date[][] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Pazartesi=0
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getMonth() !== monthDate.getMonth() && cursor > firstOfMonth) break;
  }
  return weeks;
}

/**
 * Veri Girişi takvimi: "hangi gün neler girildi" sorusuna görsel bir cevap
 * (bkz. kullanıcı talebi). Her hücre o günün toplam kayıt sayısını gösterir;
 * bir güne tıklanınca altta o günün kayıt listesi (başlık/üniversite/tür/
 * kayıt türü) açılır. content-calendar.tsx'teki ay-grid mantığından ilham
 * alınmıştır ama sürükle-bırak YOK — burası salt raporlama amaçlı.
 */
export function VeriGirisiCalendar() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function load() {
    fetch(`/api/veri-girisi/calendar?month=${monthKey(monthDate)}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    setSelectedDate(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDate]);

  // Kullanıcı talebi: takvim de F5 atmadan güncellensin.
  useLiveRefresh(load, 15000);

  const weeks = useMemo(() => buildWeeks(monthDate), [monthDate]);

  const dayByKey = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of data?.days ?? []) map.set(d.date, d);
    return map;
  }, [data]);

  const maxCount = useMemo(
    () => Math.max(1, ...(data?.days.map((d) => d.count) ?? [0])),
    [data],
  );

  const today = new Date();
  const selectedDay = selectedDate ? dayByKey.get(selectedDate) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Takvim</CardTitle>
          <CardDescription>
            {MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()} — bu ay {data?.total ?? 0} kayıt girildi.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setMonthDate(new Date())}>
            Bugün
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Takvim yükleniyor...</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((day, i) => {
                const key = dateKey(day);
                const entry = dayByKey.get(key);
                const count = entry?.count ?? 0;
                const inMonth = day.getMonth() === monthDate.getMonth();
                const isToday = sameDay(day, today);
                const isSelected = selectedDate === key;
                const intensity = count === 0 ? 0 : Math.min(1, count / maxCount);

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={count === 0}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-start justify-between rounded-md border p-1.5 text-left transition-colors",
                      inMonth ? "border-border" : "border-transparent opacity-40",
                      isSelected ? "border-primary ring-1 ring-primary" : "",
                      count > 0 ? "cursor-pointer hover:border-primary/50" : "cursor-default",
                    )}
                    style={
                      count > 0
                        ? { backgroundColor: `color-mix(in srgb, var(--primary) ${8 + intensity * 30}%, transparent)` }
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "text-xs",
                        isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" : "text-foreground/80",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {count > 0 && (
                      <Badge tone="slate" className="mt-auto text-[10px]">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-4 space-y-2 rounded-md border border-border bg-secondary/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {selectedDay.date} — {selectedDay.count} kayıt
                </p>
                <div className="space-y-1.5">
                  {selectedDay.items.map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="flex items-center gap-2 text-sm">
                      <Badge tone={item.kind === "ANNOUNCEMENT" ? "blue" : "green"} className="shrink-0">
                        {item.kind === "ANNOUNCEMENT" ? "Veri" : "Tarih"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground/90">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.universityName} · {item.typeName} · {item.createdByName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
