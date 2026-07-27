"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface University {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function ManageUniversities({ isAdmin }: { isAdmin: boolean }) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch("/api/universities?includeInactive=1")
      .then((res) => res.json())
      .then((data) => setUniversities(data.universities ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/universities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), city: city.trim() || null }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setCity("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setCreateError(data?.error ?? "Üniversite eklenemedi.");
    }
  }

  async function toggleActive(uni: University) {
    setUniversities((list) =>
      list.map((u) => (u.id === uni.id ? { ...u, isActive: !u.isActive } : u)),
    );
    await fetch(`/api/universities/${uni.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !uni.isActive }),
    });
  }

  async function importFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/universities/import", { method: "POST", body: formData });
    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      setImportResult(data);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setImportError(data?.error ?? "İçe aktarma başarısız oldu.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Üniversiteler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Duyuru, tarih, atlas ve dosya modüllerinde kullanılan üniversite referans listesi.
        </p>

        {isAdmin && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Üniversite adı</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. İstanbul Üniversitesi" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Şehir</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Örn. İstanbul" />
              </div>
              <div className="flex items-end">
                <Button onClick={create} disabled={creating || !name.trim()}>
                  Ekle
                </Button>
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}

            <div className="border-t border-border pt-3">
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
              <p className="mt-1.5 text-xs text-muted-foreground">
                İlk sütun üniversite adı, ikinci sütun şehir olarak okunur (başlık satırı isteğe bağlı).
              </p>
              {importError && <p className="mt-1.5 text-sm text-destructive">{importError}</p>}
              {importResult && (
                <div className="mt-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                  <p className="text-foreground/90">
                    {importResult.created} eklendi · {importResult.updated} güncellendi ·{" "}
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
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : universities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz üniversite eklenmemiş.</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {universities.map((uni) => (
              <div key={uni.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className={uni.isActive ? "text-foreground/90" : "text-muted-foreground line-through"}>
                    {uni.name}
                  </p>
                  {uni.city && <p className="text-xs text-muted-foreground">{uni.city}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!uni.isActive && <Badge tone="slate">Pasif</Badge>}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => toggleActive(uni)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={uni.isActive ? `${uni.name} pasifleştir` : `${uni.name} aktifleştir`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
