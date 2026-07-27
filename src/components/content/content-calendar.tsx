"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, contentStatusTone, socialPlatformLabel } from "@/lib/utils";
import { toast } from "sonner";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

type ScheduledKind = "social" | "blog";
type DeadlineKind = "seo";

interface CalendarItem {
  id: string;
  kind: ScheduledKind | DeadlineKind;
  title: string;
  subtitle: string | null;
  status: string;
  priority: string;
  date: string | null;
}

interface CalendarResponse {
  scheduled: CalendarItem[];
  deadlines: CalendarItem[];
}

const KIND_HREF: Record<ScheduledKind | DeadlineKind, string> = {
  social: "/content/social",
  blog: "/content/blog",
  seo: "/content/seo",
};

const KIND_LABEL: Record<ScheduledKind | DeadlineKind, string> = {
  social: "Sosyal",
  blog: "Blog",
  seo: "SEO",
};

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ayın haftalarını (Pazartesi başlangıçlı, tam haftalar) döner. */
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

export function ContentCalendar({ canEdit }: { canEdit: boolean }) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<CalendarItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  function load() {
    fetch(`/api/content/calendar?month=${monthKey(monthDate)}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDate]);

  // Kullanıcı talebi: takvim F5 atmadan güncellensin — sürükleme sürerken
  // dıştan gelen veriyle üzerine yazılmasın diye duraklatılır.
  useLiveRefresh(load, 10000, !dragItem);

  const weeks = useMemo(() => buildWeeks(monthDate), [monthDate]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, { scheduled: CalendarItem[]; deadlines: CalendarItem[] }>();
    if (!data) return map;
    for (const item of data.scheduled) {
      if (!item.date) continue;
      const key = new Date(item.date).toDateString();
      const entry = map.get(key) ?? { scheduled: [], deadlines: [] };
      entry.scheduled.push(item);
      map.set(key, entry);
    }
    for (const item of data.deadlines) {
      if (!item.date) continue;
      const key = new Date(item.date).toDateString();
      const entry = map.get(key) ?? { scheduled: [], deadlines: [] };
      entry.deadlines.push(item);
      map.set(key, entry);
    }
    return map;
  }, [data]);

  async function handleDrop(day: Date) {
    if (!dragItem || !dragItem.date) return;
    setDragOverDay(null);
    const original = new Date(dragItem.date);
    const next = new Date(day);
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);

    const res = await fetch(`/api/content/${dragItem.kind}/${dragItem.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduledAt: next.toISOString() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Tarih güncellenemedi.");
      setDragItem(null);
      return;
    }
    toast.success("Yayın tarihi güncellendi.");
    setDragItem(null);
    fetch(`/api/content/calendar?month=${monthKey(monthDate)}`)
      .then((r) => r.json())
      .then(setData);
  }

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">
            {monthDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}
          </span>
          <Button variant="secondary" size="icon" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonthDate(new Date())}>
            Bugün
          </Button>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Yükleniyor...</span>}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-secondary/40 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {wd}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const key = day.toDateString();
          const entry = itemsByDay.get(key);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div
              key={key}
              onDragOver={(e) => {
                if (canEdit) e.preventDefault();
              }}
              onDragEnter={() => canEdit && setDragOverDay(key)}
              onDrop={() => canEdit && handleDrop(day)}
              className={cn(
                "min-h-[7rem] space-y-1 bg-background p-1.5 text-xs",
                !isCurrentMonth && "bg-secondary/20 text-muted-foreground",
                dragOverDay === key && "ring-2 ring-inset ring-primary/50",
              )}
            >
              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]", isToday && "bg-primary text-primary-foreground font-semibold")}>
                {day.getDate()}
              </span>
              <div className="space-y-1">
                {entry?.scheduled.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    draggable={canEdit}
                    onDragStart={() => setDragItem(item)}
                    onDragEnd={() => { setDragItem(null); setDragOverDay(null); }}
                  >
                    <Link
                      href={KIND_HREF[item.kind]}
                      className={cn(
                        "block truncate rounded-md border border-border px-1.5 py-0.5 transition-colors hover:border-primary/40",
                        item.kind === "social" ? "bg-tint-blue/60" : "bg-tint-green/60",
                        canEdit && "cursor-grab active:cursor-grabbing",
                      )}
                      title={item.title}
                    >
                      <span className="font-medium text-foreground">{item.title}</span>
                      {item.kind === "social" && item.subtitle && (
                        <span className="ml-1 text-[10px] text-muted-foreground">{socialPlatformLabel(item.subtitle)}</span>
                      )}
                    </Link>
                  </div>
                ))}
                {entry?.deadlines.map((item) => (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={KIND_HREF[item.kind]}
                    className="flex items-center gap-1 truncate rounded-md border border-dashed border-border px-1.5 py-0.5 hover:border-primary/40"
                    title={item.title}
                  >
                    <Badge tone={contentStatusTone[item.status] ?? "slate"} className="shrink-0 px-1 py-0 text-[9px]">
                      {KIND_LABEL[item.kind]}
                    </Badge>
                    <span className="truncate text-foreground">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
