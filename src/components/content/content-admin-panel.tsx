"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface PermissionSet {
  canViewModule: boolean;
  canViewAllContent: boolean;
  canViewOwnContent: boolean;
  canViewTeamContent: boolean;
  canCreateContent: boolean;
  canEditOwnContent: boolean;
  canEditAllContent: boolean;
  canDeleteOwnContent: boolean;
  canDeleteAllContent: boolean;
  canApproveContent: boolean;
  canRequestRevision: boolean;
  canScheduleContent: boolean;
  canMarkPublished: boolean;
  canManageBlog: boolean;
  canManageSeo: boolean;
  canManageWebsiteWork: boolean;
  canCreateDailyReport: boolean;
  canApproveDailyReport: boolean;
  canUploadFiles: boolean;
  canDeleteFiles: boolean;
  canComment: boolean;
  canMentionUsers: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canUseAi: boolean;
  canViewAiCosts: boolean;
  canViewActivityLog: boolean;
}
interface MemberPermissionRow {
  user: { id: string; name: string | null; email: string; image: string | null };
  permissions: PermissionSet;
  hasOverride: boolean;
}

const PERMISSION_LABELS: { key: keyof PermissionSet; label: string }[] = [
  { key: "canViewModule", label: "Modülü görüntüleme" },
  { key: "canViewAllContent", label: "Tüm içerikleri görüntüleme" },
  { key: "canViewOwnContent", label: "Kendi içeriklerini görüntüleme" },
  { key: "canViewTeamContent", label: "Ekip içeriklerini görüntüleme" },
  { key: "canCreateContent", label: "İçerik oluşturma" },
  { key: "canEditOwnContent", label: "Kendi içeriğini düzenleme" },
  { key: "canEditAllContent", label: "Tüm içerikleri düzenleme" },
  { key: "canDeleteOwnContent", label: "Kendi içeriğini silme" },
  { key: "canDeleteAllContent", label: "Tüm içerikleri silme" },
  { key: "canApproveContent", label: "İçerik onaylama" },
  { key: "canRequestRevision", label: "Revizyon isteme" },
  { key: "canScheduleContent", label: "İçerik zamanlama" },
  { key: "canMarkPublished", label: "Yayınlandı olarak işaretleme" },
  { key: "canManageBlog", label: "Blog & SEO/GEO yönetimi" },
  { key: "canManageSeo", label: "SEO çalışmaları yönetimi" },
  { key: "canCreateDailyReport", label: "Günlük çalışma raporu oluşturma" },
  { key: "canApproveDailyReport", label: "Günlük çalışma raporu onaylama" },
  { key: "canUploadFiles", label: "Dosya yükleme" },
  { key: "canDeleteFiles", label: "Dosya silme" },
  { key: "canComment", label: "Yorum yapma" },
  { key: "canMentionUsers", label: "Kullanıcı etiketleme" },
  { key: "canViewReports", label: "Raporları görüntüleme" },
  { key: "canManageSettings", label: "Ayarları yönetme" },
  { key: "canUseAi", label: "Yapay zeka araçlarını kullanma" },
  { key: "canViewAiCosts", label: "Yapay zeka maliyetlerini görüntüleme" },
  { key: "canViewActivityLog", label: "Aktivite geçmişini görüntüleme" },
];

/** Modül 9 admin paneli — Finans admin panelindeki Tabs deseninin BİREBİR AYNI'sı (bkz. `finance-admin-panel.tsx`). */
export function ContentAdminPanel() {
  return (
    <Tabs defaultValue="permissions">
      <TabsList>
        <TabsTrigger value="permissions">Yetkiler</TabsTrigger>
        <TabsTrigger value="brands">Markalar</TabsTrigger>
      </TabsList>

      <TabsContent value="permissions">
        <PermissionsManager />
      </TabsContent>
      <TabsContent value="brands">
        <BrandsManager />
      </TabsContent>
    </Tabs>
  );
}

function BrandsManager() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/content/brands")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/content/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Marka eklenemedi.");
      setSubmitting(false);
      return;
    }
    setName("");
    setSubmitting(false);
    load();
  }

  async function toggleActive(brand: BrandRow) {
    await fetch(`/api/content/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !brand.isActive }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Yeni Marka/Proje Ekle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addBrand} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marka/Proje Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Mezun Kampüsü" />
            </div>
            <Button type="submit" disabled={submitting}>
              <Plus className="mr-1.5 h-4 w-4" /> Ekle
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Markalar / Projeler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {brands.length === 0 && <p className="text-sm text-muted-foreground">Marka yok.</p>}
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className={cn("truncate", !b.isActive && "text-muted-foreground line-through")}>{b.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={b.isActive ? "green" : "slate"}>{b.isActive ? "Aktif" : "Pasif"}</Badge>
                  <Button type="button" variant="secondary" size="sm" onClick={() => toggleActive(b)}>
                    {b.isActive ? "Pasife Al" : "Aktifleştir"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PermissionsManager() {
  const [rows, setRows] = useState<MemberPermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/content/permissions")
      .then((r) => r.json())
      .then((d) => setRows(d.members ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function resetOverride(userId: string) {
    await fetch(`/api/content/permissions/${userId}`, { method: "DELETE" });
    setResetTarget(null);
    load();
  }

  const editingRow = rows.find((r) => r.user.id === editingUserId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ADMIN rolündeki kullanıcılar her zaman tüm yetkilere sahiptir ve burada listelenmez. Aşağıdaki yetkiler yalnızca
        MEMBER rolündeki kullanıcılar için istisnai izinler tanımlamak amacıyla kullanılır.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Card>
          <CardContent className="space-y-1.5 pt-5">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">MEMBER rolünde kullanıcı yok.</p>}
            {rows.map((r) => (
              <div key={r.user.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.user.name} email={r.user.email} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.user.name || r.user.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.user.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={r.hasOverride ? "amber" : "slate"}>{r.hasOverride ? "Özel Yetki" : "Varsayılan"}</Badge>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditingUserId(r.user.id)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Düzenle
                  </Button>
                  {r.hasOverride && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setResetTarget(r.user.id)}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Sıfırla
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editingRow && (
        <PermissionEditorModal
          row={editingRow}
          onClose={() => setEditingUserId(null)}
          onSaved={() => {
            setEditingUserId(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        description="Bu kullanıcının özel içerik modülü yetkileri kaldırılıp varsayılanlara döndürülsün mü?"
        onConfirm={() => resetTarget && resetOverride(resetTarget)}
      />
    </div>
  );
}

function PermissionEditorModal({
  row,
  onClose,
  onSaved,
}: {
  row: MemberPermissionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<PermissionSet>(row.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/content/permissions/${row.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Yetkiler kaydedilemedi.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`İçerik Modülü Yetkileri — ${row.user.name || row.user.email}`} wide>
      <div className="space-y-3">
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {PERMISSION_LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="text-foreground/90">{label}</span>
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                  values[key] ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                    values[key] ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
