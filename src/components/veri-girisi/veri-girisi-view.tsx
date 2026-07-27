"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { VeriGirisiSummary } from "@/components/veri-girisi/veri-girisi-summary";
import { VeriGirisiCalendar } from "@/components/veri-girisi/veri-girisi-calendar";

type Kind = "ANNOUNCEMENT" | "DATE";

// Kullanıcı talebi üzerine tekli giriş formunda artık yalnızca "Veri" (eski
// adıyla Duyuru) türü kullanılıyor — "Önemli Tarih" seçeneği kaldırıldı.
// Tarihler kendi modülünden veya Excel toplu yüklemeden girilmeye devam
// ediyor; bu yüzden Kind tipi ve DATE'e ait gösterim mantığı (Son Kayıtlar
// listesinde eski/içe aktarılan tarih kayıtlarının görünmesi için) korunuyor.
const FIXED_KIND: Kind = "ANNOUNCEMENT";

interface University {
  id: string;
  name: string;
}

interface TypeOption {
  id: string;
  name: string;
}

interface MergedEntry {
  id: string;
  kind: Kind;
  title: string;
  entryDate: string;
  universityName: string;
  typeName: string;
  createdByName: string;
}

interface ImportResult {
  createdAnnouncements: number;
  createdDates: number;
  skipped: number;
  errors: string[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Duyurular + Tarihler için birleşik, sade giriş ekranı (bkz. kullanıcı
 * talebi — çalışanlar duyuruları zaten başka bir yerde takip ediyor, buraya
 * sadece Başlık/Üniversite/Tür/Giriş Tarihi girmeleri yeterli). Veri modeli
 * DEĞİŞMEDİ: bu form, seçilen "Kayıt Türü"ne göre mevcut, değişmemiş
 * /api/announcements veya /api/dates uçlarına POST atar.
 */
export function VeriGirisiView() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [announcementTypes, setAnnouncementTypes] = useState<TypeOption[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTick, setSuccessTick] = useState(0);

  const [entries, setEntries] = useState<MergedEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const isFirstEntriesLoadRef = useRef(true);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/universities")
      .then((res) => res.json())
      .then((data) => setUniversities(data.universities ?? []));
    fetch("/api/announcement-types")
      .then((res) => res.json())
      .then((data) => setAnnouncementTypes(data.types ?? []));
  }, []);

  // Kullanıcı geri bildirimi: liste birkaç saniyede bir "Yükleniyor..." yazısına
  // dönüp kendiliğinden F5 atıyormuş gibi görünüyordu. Neden: arka plandaki
  // canlı yenilemede de loadingEntries true yapılıyor, bu da listeyi anlık
  // olarak kaybettiriyordu. Artık yükleniyor göstergesi SADECE ilk yüklemede
  // gösteriliyor; sonraki sessiz yenilemeler listeyi yerinde günceller.
  function loadEntries() {
    if (isFirstEntriesLoadRef.current) setLoadingEntries(true);
    Promise.all([
      fetch("/api/announcements").then((res) => res.json()),
      fetch("/api/dates").then((res) => res.json()),
    ])
      .then(([announcementsData, datesData]) => {
        const fromAnnouncements: MergedEntry[] = (announcementsData.announcements ?? []).map(
          (a: {
            id: string;
            title: string;
            entryDate: string;
            university: { name: string };
            type: { name: string };
            createdBy: { name: string | null; email: string };
          }) => ({
            id: a.id,
            kind: "ANNOUNCEMENT" as const,
            title: a.title,
            entryDate: a.entryDate,
            universityName: a.university.name,
            typeName: a.type.name,
            createdByName: a.createdBy.name || a.createdBy.email,
          }),
        );
        const fromDates: MergedEntry[] = (datesData.dates ?? []).map(
          (d: {
            id: string;
            title: string;
            entryDate: string;
            university: { name: string };
            type: { name: string };
            createdBy: { name: string | null; email: string };
          }) => ({
            id: d.id,
            kind: "DATE" as const,
            title: d.title,
            entryDate: d.entryDate,
            universityName: d.university.name,
            typeName: d.type.name,
            createdByName: d.createdBy.name || d.createdBy.email,
          }),
        );
        const merged = [...fromAnnouncements, ...fromDates].sort(
          (a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
        );
        setEntries(merged.slice(0, 40));
      })
      .finally(() => {
        setLoadingEntries(false);
        isFirstEntriesLoadRef.current = false;
      });
  }

  useEffect(() => {
    loadEntries();
  }, [successTick]);

  // Kullanıcı talebi: kayıtlar F5 atmadan gelsin — başka bir ekip
  // arkadaşının girdiği duyuru/tarih birkaç saniye içinde listede belirir.
  useLiveRefresh(loadEntries, 8000);

  const types = announcementTypes;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!universityId || !typeId) {
      setError("Lütfen üniversite ve tür seçin.");
      return;
    }
    if (!title.trim()) {
      setError("Lütfen başlık girin.");
      return;
    }
    if (!entryDate) {
      setError("Lütfen giriş tarihi seçin.");
      return;
    }

    setSaving(true);
    const endpoint = FIXED_KIND === "ANNOUNCEMENT" ? "/api/announcements" : "/api/dates";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universityId, typeId, title: title.trim(), entryDate }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Kayıt oluşturulamadı.");
      return;
    }

    setTitle("");
    setUniversityId("");
    setTypeId("");
    setEntryDate(todayIso());
    setSuccessTick((t) => t + 1);
  }

  async function importFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/veri-girisi/import", { method: "POST", body: formData });
    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      setImportResult(data);
      loadEntries();
    } else {
      const data = await res.json().catch(() => null);
      setImportError(data?.error ?? "İçe aktarma başarısız oldu.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Tabs defaultValue="entry">
      <TabsList>
        <TabsTrigger value="entry">Giriş</TabsTrigger>
        <TabsTrigger value="report">Rapor</TabsTrigger>
      </TabsList>

      <TabsContent value="entry">
        <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Yeni Kayıt</CardTitle>
          <CardDescription>Veri girin — tek form, dört alan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Başlık</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Giriş Tarihi</Label>
                <DatePicker value={entryDate} onChange={setEntryDate} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Üniversite</Label>
                <Combobox
                  value={universityId}
                  onChange={setUniversityId}
                  options={universities.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="Seçin..."
                  searchPlaceholder="Üniversite ara..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tür</Label>
                <SimpleSelect
                  value={typeId}
                  onValueChange={setTypeId}
                  placeholder="Seçin..."
                  options={types.map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excel&apos;den Toplu Yükleme</CardTitle>
          <CardDescription>
            Sütun sırası: Kayıt Türü (Duyuru/Tarih), Başlık, Üniversite, Tür, Giriş Tarihi. Üniversite ve
            tür adları sistemdeki isimlerle birebir eşleşmelidir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importing ? "İçe aktarılıyor..." : "Excel'den İçe Aktar (.xlsx)"}
          </Button>
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          {importResult && (
            <div className="rounded-md bg-secondary/50 px-3 py-2 text-sm">
              <p className="text-foreground/90">
                {importResult.createdAnnouncements} duyuru · {importResult.createdDates} tarih eklendi ·{" "}
                {importResult.skipped} atlandı
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Son Kayıtlar</CardTitle>
          <CardDescription>Duyurular ve Tarihler modüllerinden birleşik son 40 kayıt.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingEntries ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {entries.map((entry) => (
                <div key={`${entry.kind}-${entry.id}`} className="flex items-center gap-3 py-2 text-sm">
                  <Badge tone={entry.kind === "ANNOUNCEMENT" ? "blue" : "green"} className="shrink-0">
                    {entry.kind === "ANNOUNCEMENT" ? "Veri" : "Tarih"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground/90">{entry.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.universityName} · {entry.typeName} · {entry.createdByName}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.entryDate.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </TabsContent>

      <TabsContent value="report">
        <div className="space-y-6">
          <VeriGirisiSummary />
          <VeriGirisiCalendar />
        </div>
      </TabsContent>
    </Tabs>
  );
}
