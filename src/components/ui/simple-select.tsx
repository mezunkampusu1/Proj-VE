"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export interface SimpleSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Radix Select bir öğenin value'sunun boş string olmasına izin vermez
// ("Tümü"/"Seçin..." gibi seçenekler için yaygın bir desendi). Bu sentinel
// ile dışa açık API'de boş string kullanmaya devam edilir, içeride
// dönüştürülür.
const EMPTY_SENTINEL = "__empty__";

/**
 * Eski native `<select>` kullanım deseniyle (value/onChange yerine
 * value/onValueChange + düz `options` dizisi) uyumlu, hızlı kullanım için
 * ince bir sarmalayıcı. Karmaşık/gruplu senaryolarda `Select*` alt
 * bileşenleri doğrudan kullanılabilir.
 */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <Select
      value={value === "" ? EMPTY_SENTINEL : value}
      onValueChange={(v) => onValueChange(v === EMPTY_SENTINEL ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName ?? className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY_SENTINEL} value={o.value === "" ? EMPTY_SENTINEL : o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
