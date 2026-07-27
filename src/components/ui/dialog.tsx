"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showClose = true,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
}) {
  // Bazı bileşenler (bkz. ortak-alan/document-mention.tsx: @-etiketleme
  // önerileri) kendi açılır menülerini Radix'in Portal'ı DIŞINDA, doğrudan
  // document.body'ye ekliyor (Tiptap suggestion API'sinin konumlandırma
  // gereksinimi). Radix Dialog varsayılan olarak DialogContent'in DOM alt
  // ağacı dışındaki HER tıklamayı "dışarı tıklama" sayıp modalı kapatır —
  // bu da bu tür açılır menülerdeki bir seçeneğe tıklandığında modalın
  // beklenmedik şekilde kapanmasına (ve dolayısıyla örn. görev notlarında
  // kişi etiketlemenin çalışmamasına) yol açıyordu. `data-mention-popup`
  // özniteliğini taşıyan öğelere yapılan tıklamalar burada yok sayılır.
  const ignoreFloatingMenus = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("[data-mention-popup]")) {
      event.preventDefault();
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          // w-[calc(100%-2rem)] mobilde kenarlara yapışık modal görünümünü
          // önler (dar ekranlarda 1rem boşluk bırakır); max-w-* zaten daha
          // geniş viewport'larda gerçek genişliği belirliyor.
          "fixed left-1/2 top-16 z-50 grid max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-[var(--shadow-modal)] duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        onPointerDownOutside={(event) => {
          ignoreFloatingMenus(event);
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          ignoreFloatingMenus(event);
          onInteractOutside?.(event);
        }}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Kapat</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
