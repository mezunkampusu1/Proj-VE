import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export type ContentViewFieldValue =
  | { kind: "text"; value: string }
  | { kind: "paragraph"; value: string }
  | { kind: "chips"; value: string[] }
  | { kind: "link"; value: string }
  | { kind: "node"; value: ReactNode };

export interface ContentViewField {
  label: string;
  data: ContentViewFieldValue | null | undefined;
  /** Geniş metin alanları (paragraf/uzun liste) tam satır kaplasın diye. */
  fullWidth?: boolean;
}

export interface ContentViewSectionData {
  title?: string;
  fields: ContentViewField[];
}

/** Boş/whitespace-only string'i null'a çevirir — alan otomatik gizlenir. */
export function textF(value: string | null | undefined): ContentViewFieldValue | null {
  const v = value?.trim();
  return v ? { kind: "text", value: v } : null;
}

/** Uzun metinler (açıklama/not/gövde) — kart içinde, satır sonları korunarak gösterilir. */
export function paragraphF(value: string | null | undefined): ContentViewFieldValue | null {
  const v = value?.trim();
  return v ? { kind: "paragraph", value: v } : null;
}

/**
 * Hashtag/anahtar kelime/bağlantı gibi dizi alanları — çip (pill) olarak
 * gösterilir. Boş elemanlar ve baştaki/sondaki boşluklar temizlenir (bkz.
 * kullanıcı geri bildirimi: "##" şeklinde çift önek ve ",," gibi boş
 * virgüller görünüyordu — TagInput değerleri zaten öneki (#/@) içinde
 * barındırıyor, bu yüzden burada tekrar önek eklenmez, olduğu gibi çip
 * olarak basılır).
 */
export function chipsF(value: string[] | null | undefined): ContentViewFieldValue | null {
  const items = (value ?? []).map((v) => v.trim()).filter(Boolean);
  return items.length > 0 ? { kind: "chips", value: items } : null;
}

/** URL — tıklanabilir bağlantı olarak gösterilir. */
export function linkF(value: string | null | undefined): ContentViewFieldValue | null {
  const v = value?.trim();
  return v ? { kind: "link", value: v } : null;
}

/** Hazır bir React düğümü (ör. avatar satırı) — boşsa alan gizlenir. */
export function nodeF(value: ReactNode): ContentViewFieldValue | null {
  return value ? { kind: "node", value } : null;
}

function isEmptyField(field: ContentViewField): boolean {
  return !field.data;
}

function FieldValue({ data }: { data: ContentViewFieldValue }) {
  switch (data.kind) {
    case "paragraph":
      return (
        <div className="whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-sm leading-relaxed text-foreground/90">
          {data.value}
        </div>
      );
    case "chips":
      return (
        <div className="flex flex-wrap gap-1.5">
          {data.value.map((item, i) => (
            <Badge key={i} tone="slate" className="font-normal">
              {item}
            </Badge>
          ))}
        </div>
      );
    case "link":
      return (
        <a
          href={data.value}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-medium text-primary hover:underline"
        >
          {data.value}
        </a>
      );
    case "node":
      return <div className="text-sm text-foreground/90">{data.value}</div>;
    case "text":
    default:
      return <p className="text-sm font-medium text-foreground/90">{data.value}</p>;
  }
}

/**
 * Sosyal Medya / Blog & SEO / SEO Çalışmaları görüntüleme modlarında ortak
 * kullanılan salt-okunur alan blokları (bkz. kullanıcı talebi: "görüntülemek
 * için illaki düzenleme demek gerekmesin, güzel bir okuma modu olsun" — ve
 * ardından "görüntü karman çorman duruyor" geri bildirimi üzerine tipografi
 * ve boşluklar sıkılaştırıldı). Her modal kendi alan listesini bu bileşene
 * besler; boş/null değerli alanlar ve tamamen boş bölümler otomatik gizlenir.
 */
export function ContentViewSections({ sections }: { sections: ContentViewSectionData[] }) {
  const visibleSections = sections
    .map((section) => ({ ...section, fields: section.fields.filter((f) => !isEmptyField(f)) }))
    .filter((section) => section.fields.length > 0);

  if (visibleSections.length === 0) return null;

  return (
    <div className="space-y-6">
      {visibleSections.map((section, i) => (
        <div key={i} className="space-y-3">
          {section.title && (
            <h3 className="border-b border-border pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
          )}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {section.fields.map((f, j) => (
              <div key={j} className={f.fullWidth ? "space-y-1.5 sm:col-span-2" : "min-w-0 space-y-1.5"}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{f.label}</p>
                <FieldValue data={f.data!} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
