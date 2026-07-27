"use client";

import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  documentId: string;
  isTemplate: boolean;
  templateCategory: string | null;
  isSystemTemplate: boolean;
  isAdmin: boolean;
  canEdit: boolean;
}

/**
 * Dokümanı bir şablona dönüştürme / şablon olmaktan çıkarma ayarları
 * (§14). Herhangi bir editör/sahip kendi dokümanını şablon yapabilir;
 * bir şablonu "sistem şablonu" (tüm ekip için varsayılan öneri listesinde
 * görünen, silinmesi kısıtlı) işaretlemek yalnızca ADMIN'e açıktır — bkz.
 * PATCH /api/documents/[documentId] içindeki sunucu tarafı kontrol.
 *
 * Not: yeni doküman oluştururken şablon seçme akışı (blank vs. şablondan
 * türet, kategoriye göre gruplanmış liste) Ana Ekran görevinde (§ana
 * ekran) inşa edilecek — "yeni doküman" oluşturma UI'ı henüz o modülde
 * yaşıyor. Burada yalnızca mevcut dokümanı şablona çevirme/geri alma
 * ayarları var.
 */
export function TemplateSettings({
  documentId,
  isTemplate: initialIsTemplate,
  templateCategory: initialCategory,
  isSystemTemplate: initialIsSystem,
  isAdmin,
  canEdit,
}: Props) {
  const [isTemplate, setIsTemplate] = useState(initialIsTemplate);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [isSystemTemplate, setIsSystemTemplate] = useState(initialIsSystem);
  const [saving, setSaving] = useState(false);

  if (!canEdit) return null;

  const save = async (patch: Partial<{ isTemplate: boolean; templateCategory: string | null; isSystemTemplate: boolean }>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error);
      }
      if ("isTemplate" in patch) setIsTemplate(!!patch.isTemplate);
      if ("templateCategory" in patch) setCategory(patch.templateCategory ?? "");
      if ("isSystemTemplate" in patch) setIsSystemTemplate(!!patch.isSystemTemplate);
      toast.success("Şablon ayarları güncellendi.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Şablon ayarları"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground",
            isTemplate && "text-primary",
          )}
        >
          <LayoutTemplate className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end" overlay>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Şablon olarak işaretle</span>
          <Button
            size="sm"
            variant={isTemplate ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => save({ isTemplate: !isTemplate })}
          >
            {isTemplate ? "Şablon" : "Normal doküman"}
          </Button>
        </div>

        {isTemplate && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Kategori</label>
              <div className="flex gap-1.5">
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ör. Toplantı, Rapor"
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => save({ templateCategory: category.trim() || null })}>
                  Kaydet
                </Button>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border border-border p-2">
                <div>
                  <p className="text-xs font-medium text-foreground">Sistem şablonu</p>
                  <p className="text-[11px] text-muted-foreground">Tüm ekibe önerilir, silinmesi kısıtlanır.</p>
                </div>
                <Button
                  size="sm"
                  variant={isSystemTemplate ? "primary" : "secondary"}
                  disabled={saving}
                  onClick={() => save({ isSystemTemplate: !isSystemTemplate })}
                >
                  {isSystemTemplate ? "Açık" : "Kapalı"}
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
