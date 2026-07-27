"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Geriye dönük uyumlu Modal sarmalayıcısı. İç yapı Radix Dialog'a
 * (shadcn/ui) taşınmıştır; mevcut kullanım yerlerinin (open/onClose/title/
 * children/wide) değişmesine gerek kalmaması için aynı API korunmuştur.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(wide ? "max-w-2xl" : "max-w-md")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
