"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateTeamButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Takım oluşturulamadı.");
      return;
    }

    const { team } = await res.json();
    setOpen(false);
    setName("");
    router.push(`/teams/${team.id}`);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Yeni Takım</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Yeni Takım Oluştur">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-tint-red px-3 py-2 text-sm text-tint-red-foreground">{error}</p>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Takım Adı</label>
            <Input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ürün Ekibi"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
