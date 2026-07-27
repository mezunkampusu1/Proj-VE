"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnnouncementModal } from "@/components/announcements/announcement-modal";
import { AnnouncementsSummary } from "@/components/announcements/announcements-summary";
import { DayNavigator } from "@/components/announcements/day-navigator";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface University {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface AnnouncementType {
  id: string;
  name: string;
}

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  entryDate: string;
  createdAt: string;
  university: { id: string; name: string; city: string | null };
  type: { id: string; name: string };
  createdBy: { id: string; name: string | null; email: string };
  tags: { tag: { id: string; name: string; color: string | null } }[];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AnnouncementsView({
  currentUserId,
  isAdmin,
  members,
}: {
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [types, setTypes] = useState<AnnouncementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [q, setQ] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Bildirimden "direkt etiketlenen şeye git" (bkz. kullanıcı talebi #4):
  // bildirim linki `/announcements?open=<id>` şeklinde gelir, burada
  // sayfa açılır açılmaz o duyurunun düzenleme/detay modalı otomatik
  // açılır — liste o günün tarih filtresine uymasa bile (modal kendi
  // verisini id ile ayrıca çeker, listeye bağımlı değildir).
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      setEditingId(openId);
      setModalOpen(true);
      router.replace("/announcements", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("entryDate", selectedDate);
    if (q.trim()) params.set("q", q.trim());
    if (universityId) params.set("universityId", universityId);
    if (typeId) params.set("typeId", typeId);
    fetch(`/api/announcements?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setAnnouncements(data.announcements ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/universities")
      .then((res) => res.json())
      .then((data) => setUniversities(data.universities ?? []));
    fetch("/api/announcement-types")
      .then((res) => res.json())
      .then((data) => setTypes(data.types ?? []));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, universityId, typeId, selectedDate]);

  // Kullanıcı talebi: liste F5 atmadan gelsin — modal açıkken de zararsız,
  // modal kendi verisini id ile ayrıca çekiyor.
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
          <TabsTrigger value="list">Günlük Takip</TabsTrigger>
          <TabsTrigger value="summary">Özet</TabsTrigger>
        </TabsList>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Yeni Duyuru
        </Button>
      </div>

      <TabsContent value="list" className="space-y-4">
        <DayNavigator value={selectedDate} onChange={setSelectedDate} count={loading ? undefined : announcements.length} />

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
        ) : announcements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">Bu tarihte kayıtlı duyuru bulunamadı.</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {announcements.map((a) => (
              <div
                key={a.id}
                onClick={() => openEdit(a.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
              >
                <Badge tone="blue" className="hidden shrink-0 sm:inline-flex">
                  {a.type.name}
                </Badge>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                    <Badge tone="blue" className="shrink-0 sm:hidden">
                      {a.type.name}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.university.name}
                    {a.university.city ? ` · ${a.university.city}` : ""}
                    {a.tags.length > 0 && (
                      <span className="ml-1.5">
                        {a.tags.map((t) => `#${t.tag.name}`).join(" ")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 sm:flex" title={a.createdBy.name || a.createdBy.email}>
                  <Avatar name={a.createdBy.name} email={a.createdBy.email} size={22} />
                  <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {a.createdBy.name || a.createdBy.email}
                  </span>
                </div>

                {a.sourceUrl && (
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Kaynağı aç"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <AnnouncementsSummary />
      </TabsContent>

      <AnnouncementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        announcementId={editingId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        members={members}
      />
    </Tabs>
  );
}
