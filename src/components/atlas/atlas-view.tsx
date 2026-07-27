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
import { degreeLevelLabel, formatDate, cn } from "@/lib/utils";
import { AtlasProgramModal } from "@/components/atlas/atlas-program-modal";
import { AtlasSummary } from "@/components/atlas/atlas-summary";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface Institute {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface AtlasProgramItem {
  id: string;
  name: string;
  degreeLevel: "YUKSEK_LISANS" | "DOKTORA";
  isActive: boolean;
  entryDate: string;
  updatedAt: string;
  institute: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string };
  mentions: { user: { id: string; name: string | null; email: string } }[];
}

type QuickFilter = "all" | "today" | "updatedToday" | "inactive";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "today", label: "Bugün Girilenler" },
  { value: "updatedToday", label: "Bugün Güncellenenler" },
  { value: "inactive", label: "Pasifler" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function updatedAgoLabel(updatedAt: string) {
  const today = new Date(`${todayIso()}T00:00:00.000Z`);
  const target = new Date(`${updatedAt.slice(0, 10)}T00:00:00.000Z`);
  const diff = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Bugün güncellendi";
  if (diff === 1) return "Dün güncellendi";
  return `${diff} gün önce güncellendi`;
}

export function AtlasView({
  currentUserId,
  isAdmin,
  members,
}: {
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const [programs, setPrograms] = useState<AtlasProgramItem[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
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
      router.replace("/atlas", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (instituteId) params.set("instituteId", instituteId);
    if (degreeLevel) params.set("degreeLevel", degreeLevel);
    if (quickFilter === "inactive") params.set("includeInactive", "1");
    if (quickFilter === "today") params.set("entryDate", todayIso());
    if (quickFilter === "updatedToday") params.set("updatedToday", "1");
    fetch(`/api/atlas/programs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const items: AtlasProgramItem[] = data.programs ?? [];
        setPrograms(quickFilter === "inactive" ? items.filter((p) => !p.isActive) : items);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/institutes")
      .then((res) => res.json())
      .then((data) => setInstitutes(data.institutes ?? []));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, instituteId, degreeLevel, quickFilter]);

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
          <TabsTrigger value="list">Programlar</TabsTrigger>
          <TabsTrigger value="summary">Özet</TabsTrigger>
        </TabsList>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Yeni Program
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
            placeholder="Program adında ara..."
            className="w-full sm:w-52"
          />
          <Combobox
            value={instituteId}
            onChange={setInstituteId}
            options={[
              { value: "", label: "Tüm Enstitüler" },
              ...institutes.map((i) => ({ value: i.id, label: i.name })),
            ]}
            placeholder="Tüm Enstitüler"
            searchPlaceholder="Enstitü ara..."
            className="w-full sm:w-56"
          />
          <SimpleSelect
            value={degreeLevel}
            onValueChange={setDegreeLevel}
            className="w-full sm:w-40"
            options={[
              { value: "", label: "Tüm Dereceler" },
              { value: "YUKSEK_LISANS", label: "Yüksek Lisans" },
              { value: "DOKTORA", label: "Doktora" },
            ]}
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : programs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Bu filtreye uyan program bulunamadı.</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {programs.map((p) => (
              <div
                key={p.id}
                onClick={() => openEdit(p.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
              >
                <Badge tone={p.degreeLevel === "DOKTORA" ? "amber" : "blue"} className="hidden shrink-0 sm:inline-flex">
                  {degreeLevelLabel(p.degreeLevel)}
                </Badge>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <Badge tone={p.degreeLevel === "DOKTORA" ? "amber" : "blue"} className="shrink-0 sm:hidden">
                      {degreeLevelLabel(p.degreeLevel)}
                    </Badge>
                    {!p.isActive && <Badge tone="slate">Pasif</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.institute.name}
                    {p.mentions.length > 0 && (
                      <span className="ml-1.5">
                        {p.mentions.map((m) => `@${m.user.name || m.user.email}`).join(" ")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 sm:flex" title={p.createdBy.name || p.createdBy.email}>
                  <Avatar name={p.createdBy.name} email={p.createdBy.email} size={22} />
                  <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {p.createdBy.name || p.createdBy.email}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">Giriş: {formatDate(p.entryDate)}</span>
                  <Badge tone="slate">{updatedAgoLabel(p.updatedAt)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <AtlasSummary />
      </TabsContent>

      <AtlasProgramModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        programId={editingId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        members={members}
      />
    </Tabs>
  );
}
