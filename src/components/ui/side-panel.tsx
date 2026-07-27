"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Trello tarzı sağdan açılan kayar detay paneli. `Modal`ın ortalanmış/
 * kutu düzeni yerine tam yükseklikte, sağa yaslı bir düzen kullanır — görev
 * detayı (notlar, kontrol listesi, dosyalar, etiketler) gibi uzun/çok
 * bölümlü içerikler için daha ferah bir alan sağlar.
 */
export function SidePanel({
  open,
  onClose,
  title,
  headerExtra,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-card text-card-foreground shadow-[var(--shadow-modal)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-1.5">
              {headerExtra}
              <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground ring-offset-background transition-opacity hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <X className="h-4 w-4" />
                <span className="sr-only">Kapat</span>
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
