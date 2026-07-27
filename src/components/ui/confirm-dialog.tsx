"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/**
 * Native `window.confirm()` yerine kullanılan, temaya uygun onay
 * diyaloğu. Silme gibi geri alınamaz işlemler için kullanılır. Çağıran
 * bileşen `open` durumunu (genellikle "hangi kayıt silinmek isteniyor"
 * bilgisiyle) kendi state'inde tutar; bu bileşen yalnızca görünümü ve
 * onay/vazgeç aksiyonlarını yönetir.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Emin misiniz?",
  description,
  confirmLabel = "Sil",
  cancelLabel = "Vazgeç",
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="secondary">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
