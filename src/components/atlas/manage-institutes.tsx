"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Institute {
  id: string;
  name: string;
  isActive: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Enstitüler artık üniversitelerden bağımsız, düz bir referans listesi
 * (bkz. Institute modeli) — manage-universities.tsx ile birebir aynı desen:
 * ekleme, aktif/pasif etme ve Excel'den toplu içe aktarma.
 */
export function ManageInstitutes({ isAdmin }: { isAdmin: boolean }) {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch("/api/institutes?includeInactive=1")
      .then((res) => res.json())
      .then((data) => setInstitutes(data.institutes ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/institutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setCreateError(data?.error ?? "Enstitü eklenemedi.");
    }
  }

  async function toggleActive(inst: Institute) {
    setInstitutes((list) =>
      list.map((i) => (i.id === inst.id ? { ...i, isActive: !i.isActive } : i)),
    );
    await fetch(`/api/institutes/${inst.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !inst.isActive }),
    });
  }

  async function importFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/institutes/import", { method: "POST", body: formData });
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
        <CardTitle>Enstitüler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Atlas modülünde program hiyerarşisinin referans verisi — üniversitelerden bağımsız yönetilir.
        </p>

        {isAdmin && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Enstitü adı</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Fen Bilimleri Enstitüsü" />
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
                İlk sütun enstitü adı olarak okunur (başlık satırı isteğe bağlı).
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
        ) : institutes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz enstitü eklenmemiş.</p>
        ) : (
          <div className="max-h-72 divide-y divide-border overflow-y-auto">
            {institutes.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <p className={inst.isActive ? "text-foreground/90" : "text-muted-foreground line-through"}>
                  {inst.name}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  {!inst.isActive && <Badge tone="slate">Pasif</Badge>}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => toggleActive(inst)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={inst.isActive ? `${inst.name} pasifleştir` : `${inst.name} aktifleştir`}
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
