"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface CategoryRow {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  isActive: boolean;
  parentCategoryId: string | null;
}
interface CurrencyRow {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isActive: boolean;
  currentRate: number | null;
}
interface RateHistoryRow {
  id: string;
  rateToTry: string | number;
  createdAt: string;
  currency: { code: string };
  setBy: { name: string | null; email: string };
}
interface PermissionSet {
  canViewFinance: boolean;
  canViewOwnRecords: boolean;
  canViewAllRecords: boolean;
  canCreateRecords: boolean;
  canEditOwnRecords: boolean;
  canEditAllRecords: boolean;
  canDeleteRecords: boolean;
  canViewReports: boolean;
  canViewAttachments: boolean;
  canManageCategories: boolean;
  canManageRates: boolean;
}
interface MemberPermissionRow {
  user: { id: string; name: string | null; email: string; image: string | null };
  permissions: PermissionSet;
  hasOverride: boolean;
}

const PERMISSION_LABELS: { key: keyof PermissionSet; label: string }[] = [
  { key: "canViewFinance", label: "Finans sayfasını görüntüleme" },
  { key: "canViewOwnRecords", label: "Kendi kayıtlarını görüntüleme" },
  { key: "canViewAllRecords", label: "Tüm kayıtları görüntüleme" },
  { key: "canCreateRecords", label: "Kayıt ekleme" },
  { key: "canEditOwnRecords", label: "Kendi kayıtlarını düzenleme" },
  { key: "canEditAllRecords", label: "Tüm kayıtları düzenleme" },
  { key: "canDeleteRecords", label: "Kayıt silme" },
  { key: "canViewReports", label: "Raporları görüntüleme" },
  { key: "canViewAttachments", label: "Belgeleri görüntüleme" },
  { key: "canManageCategories", label: "Kategori yönetimi" },
  { key: "canManageRates", label: "Para birimi/kur yönetimi" },
];

export function FinanceAdminPanel() {
  return (
    <Tabs defaultValue="categories">
      <TabsList>
        <TabsTrigger value="categories">Kategoriler</TabsTrigger>
        <TabsTrigger value="currencies">Para Birimleri &amp; Kurlar</TabsTrigger>
        <TabsTrigger value="permissions">Yetkiler</TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <CategoriesManager />
      </TabsContent>
      <TabsContent value="currencies">
        <CurrenciesManager />
      </TabsContent>
      <TabsContent value="permissions">
        <PermissionsManager />
      </TabsContent>
    </Tabs>
  );
}

function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/finance/categories?includeInactive=1")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/finance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Kategori eklenemedi.");
      setSubmitting(false);
      return;
    }
    setName("");
    setSubmitting(false);
    load();
  }

  async function toggleActive(cat: CategoryRow) {
    await fetch(`/api/finance/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    load();
  }

  async function remove(cat: CategoryRow) {
    const res = await fetch(`/api/finance/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Kategori silinemedi.");
      return;
    }
    load();
  }

  const expense = categories.filter((c) => c.type === "EXPENSE");
  const income = categories.filter((c) => c.type === "INCOME");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Yeni Kategori Ekle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kategori Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ofis Kirası" />
            </div>
            <div className="min-w-[140px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tür</Label>
              <SimpleSelect
                value={type}
                onValueChange={(v) => setType(v as "EXPENSE" | "INCOME")}
                options={[
                  { value: "EXPENSE", label: "Gider" },
                  { value: "INCOME", label: "Gelir" },
                ]}
              />
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
        <div className="grid gap-4 lg:grid-cols-2">
          <CategoryListCard title="Gider Kategorileri" rows={expense} onToggle={toggleActive} onRemove={remove} />
          <CategoryListCard title="Gelir Kategorileri" rows={income} onToggle={toggleActive} onRemove={remove} />
        </div>
      )}
    </div>
  );
}

function CategoryListCard({
  title,
  rows,
  onToggle,
  onRemove,
}: {
  title: string;
  rows: CategoryRow[];
  onToggle: (c: CategoryRow) => void;
  onRemove: (c: CategoryRow) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Kategori yok.</p>}
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className={cn("truncate", !c.isActive && "text-muted-foreground line-through")}>{c.name}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone={c.isActive ? "green" : "slate"}>{c.isActive ? "Aktif" : "Pasif"}</Badge>
              <Button type="button" variant="secondary" size="sm" onClick={() => onToggle(c)}>
                {c.isActive ? "Pasife Al" : "Aktifleştir"}
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={() => onRemove(c)}>
                Sil
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CurrenciesManager() {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [history, setHistory] = useState<RateHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/finance/currencies").then((r) => r.json()),
      fetch("/api/finance/rates").then((r) => r.json()),
    ])
      .then(([c, h]) => {
        setCurrencies(c.currencies ?? []);
        setHistory(h.rates ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveRate(currencyId: string) {
    const value = Number(rateInputs[currencyId]);
    if (!value || value <= 0) {
      setError("Lütfen geçerli bir kur girin.");
      return;
    }
    setSavingId(currencyId);
    setError(null);
    const res = await fetch("/api/finance/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currencyId, rateToTry: value }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Kur kaydedilemedi.");
      setSavingId(null);
      return;
    }
    setRateInputs((prev) => ({ ...prev, [currencyId]: "" }));
    setSavingId(null);
    load();
  }

  async function toggleActive(c: CurrencyRow) {
    const res = await fetch(`/api/finance/currencies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Güncellenemedi.");
      return;
    }
    load();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Para Birimleri ve Güncel Kurlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currencies.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-[100px]">
                  <p className="text-sm font-medium text-foreground">
                    {c.code} <span className="text-xs text-muted-foreground">({c.symbol})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                </div>
                <div className="text-sm text-foreground/90">
                  {c.isBase ? (
                    <span className="text-muted-foreground">Temel para birimi — kur her zaman 1</span>
                  ) : c.currentRate !== null ? (
                    <span>
                      Güncel kur: <span className="font-medium">{c.currentRate}</span> TL
                    </span>
                  ) : (
                    <span className="text-tint-amber-foreground">Kur tanımlı değil</span>
                  )}
                </div>
                {!c.isBase && (
                  <div className="ml-auto flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      placeholder="Yeni kur"
                      className="w-28"
                      value={rateInputs[c.id] ?? ""}
                      onChange={(e) => setRateInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                    <Button type="button" size="sm" disabled={savingId === c.id} onClick={() => saveRate(c.id)}>
                      Kur Gir
                    </Button>
                    <Badge tone={c.isActive ? "green" : "slate"}>{c.isActive ? "Aktif" : "Pasif"}</Badge>
                    <Button type="button" variant="secondary" size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Pasife Al" : "Aktifleştir"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kur Geçmişi (Son 20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Henüz kur girilmemiş.</p>}
          {history.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground/90">
                1 {r.currency.code} = {Number(r.rateToTry)} TL
              </span>
              <span className="text-xs text-muted-foreground">
                {r.setBy.name || r.setBy.email} · {new Date(r.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
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
    fetch("/api/finance/permissions")
      .then((r) => r.json())
      .then((d) => setRows(d.members ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function resetOverride(userId: string) {
    await fetch(`/api/finance/permissions/${userId}`, { method: "DELETE" });
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
        description="Bu kullanıcının özel finans yetkileri kaldırılıp varsayılanlara döndürülsün mü?"
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
    const res = await fetch(`/api/finance/permissions/${row.user.id}`, {
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
    <Modal open onClose={onClose} title={`Finans Yetkileri — ${row.user.name || row.user.email}`} wide>
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
