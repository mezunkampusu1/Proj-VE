"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  parentFolderId: string | null;
  onCreated: () => void;
}

export function NewFolderDialog({ open, onClose, parentFolderId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/document-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentFolderId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error);
      }
      toast.success("Klasör oluşturuldu.");
      setName("");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Klasör oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Yeni Klasör">
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Klasör adı"
          autoFocus
        />
        <Button className="w-full" disabled={saving || !name.trim()} onClick={submit}>
          Oluştur
        </Button>
      </div>
    </Modal>
  );
}
