"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate, cn } from "@/lib/utils";
import { DateModal } from "@/components/dates/date-modal";
import { DatesSummary } from "@/components/dates/dates-summary";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface University {
  id: string;
  name: string;
}

interface DateType {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface ImportantDateItem {
  id: string;
  title: string;
  description: string | null;
  entryDate: string;
  date: string | null;
  university: { id: string; name: string; city: string | null };
  type: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string };
  mentions: { user: MemberOption }[];
}

type QuickFilter = "all" | "today" | "pending" | "has" | "upcoming7" | "overdue";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "today", label: "Bugün Girilenler" },
  { value: "pending", label: "Bitiş Tarihi Bekleyenler" },
  { value: "has", label: "Bitiş Tarihi Belirlenenler" },
  { value: "upcoming7", label: "Yaklaşan (7 gün)" },
  { value: "overdue", label: "Süresi Geçen" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr: string) {
  const today = new Date(`${todayIso()}T00:00:00.000Z`);
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function RemainingBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) {
    return <Badge tone="slate">Bitiş tarihi bekleniyor</Badge>;
  }
  const diff = daysUntil(dateStr);
  if (diff < 0) {
    return <Badge tone="red">{Math.abs(diff)} gün önce geçti</Badge>;
  }
  if (diff === 0) {
    return <Badge tone="amber">Bugün</Badge>;
  }
  if (diff <= 7) {
    return <Badge tone="amber">{diff} gün kaldı</Badge>;
  }
  return <Badge tone="slate">{diff} gün kaldı</Badge>;
}

export function DatesView({
  currentUserId,
  isAdmin,
  members,
}: {
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const [dates, setDates] = useState<ImportantDateItem[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [types, setTypes] = useState<DateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      setEditingId(openId);
      setModalOpen(true);
      router.replace("/dates", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (universityId) params.set("universityId", universityId);
    if (typeId) params.set("typeId", typeId);

    const today = todayIso();
    if (quickFilter === "today") params.set("entryDate", today);
    if (quickFilter === "pending") params.set("endDateStatus", "pending");
    if (quickFilter === "has") params.set("endDateStatus", "has");
    if (quickFilter === "upcoming7") {
      params.set("dateFrom", today);
      params.set("dateTo", addDaysIso(today, 7));
    }
    if (quickFilter === "overdue") {
      params.set("dateTo", addDaysIso(today, -1));
    }

    fetch(`/api/dates?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setDates(data.dates ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/universities")
      .then((res) => res.json())
      .then((data) => setUniversities(data.universities ?? []));
    fetch("/api/date-types")
      .then((res) => res.json())
      .then((data) => setTypes(data.types ?? []));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, universityId, typeId, quickFilter]);

  // Kullanıcı talebi: liste F5 atmadan gelsin.
  useLiveRefresh(load, 8000);

  function openCreate() {
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setModalOpen(true);
  }

  return (
    <Tabs defaultValue="list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="list">Tarihler</TabsTrigger>
          <TabsTrigger value="summary">Özet</TabsTrigger>
        </TabsList>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Yeni Tarih
        </Button>
      </div>

      <TabsContent value="list" className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setQuickFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                quickFilter === f.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Başlıkta ara..."
            className="w-full sm:w-56"
          />
          <Combobox
            value={universityId}
            onChange={setUniversityId}
            options={[
              { value: "", label: "Tüm Üniversiteler" },
              ...universities.map((u) => ({ value: u.id, label: u.name })),
            ]}
            placeholder="Tüm Üniversiteler"
            searchPlaceholder="Üniversite ara..."
            className="w-full sm:w-64"
          />
          <SimpleSelect
            value={typeId}
            onValueChange={setTypeId}
            className="w-full sm:w-40"
            options={[{ value: "", label: "Tüm Türler" }, ...types.map((t) => ({ value: t.id, label: t.name }))]}
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : dates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Bu filtreye uyan tarih bulunamadı.</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {dates.map((d) => (
              <div
                key={d.id}
                onClick={() => openEdit(d.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
              >
                <Badge tone="blue" className="hidden shrink-0 sm:inline-flex">
                  {d.type.name}
                </Badge>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                    <Badge tone="blue" className="shrink-0 sm:hidden">
                      {d.type.name}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.university.name}
                    {d.university.city ? ` · ${d.university.city}` : ""}
                    {d.mentions.length > 0 && (
                      <span className="ml-1.5">
                        {d.mentions.map((m) => `@${m.user.name || m.user.email}`).join(" ")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 sm:flex" title={d.createdBy.name || d.createdBy.email}>
                  <Avatar name={d.createdBy.name} email={d.createdBy.email} size={22} />
                  <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {d.createdBy.name || d.createdBy.email}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    Giriş: {formatDate(d.entryDate)}
                    {d.date ? ` · Bitiş: ${formatDate(d.date)}` : ""}
                  </span>
                  <RemainingBadge dateStr={d.date} />
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <DatesSummary />
      </TabsContent>

      <DateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        dateId={editingId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        members={members}
      />
    </Tabs>
  );
}
