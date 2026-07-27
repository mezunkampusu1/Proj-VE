"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Pencil, Check, X, ShieldCheck, ShieldOff, ExternalLink, ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { documentStatusLabel, documentAuditActionLabel, cn } from "@/lib/utils";

interface StatsResponse {
  counts: {
    totalDocuments: number;
    totalFolders: number;
    totalTemplates: number;
    trashCount: number;
    archivedCount: number;
    pendingApprovals: number;
  };
  totals: { wordCount: number; charCount: number };
  byStatus: { status: string; count: number }[];
  byType: { typeId: string; typeName: string; count: number }[];
  recentAudit: {
    id: string;
    documentId: string | null;
    documentTitleSnapshot: string;
    action: string;
    description: string | null;
    createdAt: string;
    actor: { id: string; name: string | null; email: string | null };
  }[];
}

interface DocumentTypeRow {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
}

interface TemplateRow {
  id: string;
  title: string;
  templateCategory: string | null;
  isSystemTemplate: boolean;
  updatedAt: string;
  owner: { id: string; name: string | null; email: string | null };
}

const STAT_CARDS: { key: keyof StatsResponse["counts"]; label: string }[] = [
  { key: "totalDocuments", label: "Toplam Doküman" },
  { key: "totalFolders", label: "Klasör" },
  { key: "totalTemplates", label: "Şablon" },
  { key: "pendingApprovals", label: "Onay Bekleyen" },
  { key: "archivedCount", label: "Arşivde" },
  { key: "trashCount", label: "Çöp Kutusunda" },
];

/**
 * Ortak Alan yönetici paneli: özet istatistikler + doküman türü yönetimi
 * + şablon yönetimi + son denetim kayıtları önizlemesi (tam liste görev
 * #160'taki ayrı denetim kaydı sayfasında).
 */
export function AdminDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [types, setTypes] = useState<DocumentTypeRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<TemplateRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, typesRes, templatesRes] = await Promise.all([
        fetch("/api/documents/admin/stats"),
        fetch("/api/document-types"),
        fetch("/api/documents?scope=templates"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (typesRes.ok) setTypes((await typesRes.json()).types ?? []);
      if (templatesRes.ok) setTemplates((await templatesRes.json()).documents ?? []);
    } catch {
      toast.error("Yönetici paneli verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveTypeRename = async (typeId: string) => {
    if (!editingTypeName.trim()) return;
    try {
      const res = await fetch(`/api/document-types/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingTypeName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTypes((prev) => prev.map((t) => (t.id === typeId ? json.type : t)));
      setEditingTypeId(null);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Tür güncellenemedi.");
    }
  };

  const toggleSystemTemplate = async (template: TemplateRow) => {
    try {
      const res = await fetch(`/api/documents/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSystemTemplate: !template.isSystemTemplate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, isSystemTemplate: json.document.isSystemTemplate } : t)),
      );
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Şablon güncellenemedi.");
    }
  };

  const deleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    try {
      const res = await fetch(`/api/documents/${deleteTemplateTarget.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateTarget.id));
      toast.success("Şablon çöp kutusuna taşındı.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Şablon silinemedi.");
    } finally {
      setDeleteTemplateTarget(null);
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((c) => (
          <Card key={c.key}>
            <CardContent className="pt-5">
              <p className="text-2xl font-semibold text-foreground">{stats.counts[c.key]}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-medium text-foreground">Duruma Göre Dağılım</p>
            {stats.byStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground">Henüz doküman yok.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.byStatus
                  .sort((a, b) => b.count - a.count)
                  .map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{documentStatusLabel(s.status)}</span>
                      <span className="font-medium text-foreground">{s.count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-medium text-foreground">Türe Göre Dağılım</p>
            {stats.byType.length === 0 ? (
              <p className="text-xs text-muted-foreground">Türlendirilmiş doküman yok.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.byType.map((t) => (
                  <div key={t.typeId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.typeName}</span>
                    <span className="font-medium text-foreground">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Doküman Türleri</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Doküman türü artık düzenleme biçimini de belirlediği için liste sabittir: Word (zengin metin) ve
            Excel (tablo/formül). Yalnızca görünen adı değiştirebilirsiniz.
          </p>
          <div className="divide-y divide-border">
            {types.map((type) => (
              <div key={type.id} className="flex items-center justify-between gap-3 py-2">
                {editingTypeId === type.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editingTypeName}
                      onChange={(e) => setEditingTypeName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveTypeRename(type.id)}
                      className="h-8 max-w-xs"
                      autoFocus
                    />
                    <button onClick={() => saveTypeRename(type.id)} className="text-tint-green-foreground">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingTypeId(null)} className="text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{type.name}</span>
                    {type.isSystem && <Badge tone="slate">Sistem</Badge>}
                  </div>
                )}
                {editingTypeId !== type.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTypeId(type.id);
                        setEditingTypeName(type.name);
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Yeniden adlandır"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {types.length === 0 && <p className="py-2 text-xs text-muted-foreground">Henüz tür tanımlanmadı.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm font-medium text-foreground">Şablonlar</p>
          <div className="divide-y divide-border">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/ortak-alan/${t.id}`} className="truncate text-sm font-medium text-foreground hover:underline">
                      {t.title || "Adsız şablon"}
                    </Link>
                    {t.isSystemTemplate && <Badge tone="blue">Sistem Şablonu</Badge>}
                    {t.templateCategory && <Badge tone="slate">{t.templateCategory}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.owner.name || t.owner.email} · {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true, locale: tr })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleSystemTemplate(t)}
                    className={cn(
                      "rounded-lg p-1.5 hover:bg-accent",
                      t.isSystemTemplate ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                    title={t.isSystemTemplate ? "Sistem şablonu olmaktan çıkar" : "Sistem şablonu yap"}
                  >
                    {t.isSystemTemplate ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  </button>
                  <Link
                    href={`/ortak-alan/${t.id}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Aç"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => setDeleteTemplateTarget(t)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-tint-red-bg hover:text-tint-red-foreground"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="py-2 text-xs text-muted-foreground">Henüz şablon oluşturulmadı.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Son Denetim Kayıtları</p>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/ortak-alan/admin/audit" className="gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> Tüm Kayıtlar
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {stats.recentAudit.map((a) => (
              <div key={a.id} className="py-2 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">{a.actor.name || a.actor.email}</span>{" "}
                  <span className="text-muted-foreground">— {documentAuditActionLabel(a.action)} —</span>{" "}
                  {a.documentId ? (
                    <Link href={`/ortak-alan/${a.documentId}`} className="hover:underline">
                      {a.documentTitleSnapshot}
                    </Link>
                  ) : (
                    a.documentTitleSnapshot
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: tr })}
                </p>
              </div>
            ))}
            {stats.recentAudit.length === 0 && <p className="py-2 text-xs text-muted-foreground">Henüz kayıt yok.</p>}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTemplateTarget}
        onOpenChange={(open) => !open && setDeleteTemplateTarget(null)}
        title="Şablonu sil"
        description={`"${deleteTemplateTarget?.title}" şablonunu çöp kutusuna taşımak istediğinize emin misiniz?`}
        onConfirm={deleteTemplate}
      />
    </div>
  );
}
