"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  collisionPadding = 8,
  overlay = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
  /**
   * Büyük "menü" tarzı panellerde (Bildirim Tercihleri, Şablon Ayarları,
   * Dışa Aktar, Kopyala, Göreve Bağla gibi) arkaya hafif bir karartma
   * ekler — böylece panel altındaki araç çubuğu/sekme metinleriyle üst
   * üste biniyormuş gibi görünmez, "geçici bir katman" olduğu netleşir
   * (bkz. tekrarlanan ekran görüntüsü şikayetleri). Üniversite/tarih
   * seçici gibi sık kullanılan küçük form alanlarında varsayılan olarak
   * KAPALI bırakıldı — her tıklamada tüm sayfayı karartmak orada gereksiz
   * ağır hissettirir.
   */
  overlay?: boolean;
}) {
  return (
    <>
      {/*
        Radix'in Portal'ı tek bir kök çocuk bekliyor — karartma katmanını
        içerik ile AYNI Portal içine ikinci bir kardeş olarak eklemek
        "Primitive.div failed to slot onto its children" React hatasına
        (ve bunun tetiklediği tüm sayfa çökmesine) yol açtı. Çözüm: her
        biri kendi Portal'ında, ayrı ayrı render edilsin.
      */}
      {overlay && (
        <PopoverPrimitive.Portal>
          <div className="fixed inset-0 z-40 bg-background/50 duration-150 animate-in fade-in-0" />
        </PopoverPrimitive.Portal>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            // max-w-[calc(100vw-2rem)]: dar pencerelerde (ör. bildirim
            // tercihleri paneli gibi sabit w-80 genişlikli popover'lar)
            // içerik ekranın kenarından taşıp kırpılmasın diye — Radix'in
            // kendi çakışma önleme mantığı konumu kaydırıyor ama genişliği
            // küçültmüyor, bu yüzden gerçek üst sınırı burada koyuyoruz.
            "z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Portal>
    </>
  );
}
