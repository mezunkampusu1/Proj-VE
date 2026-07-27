"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export function ManageTags({ isAdmin }: { isAdmin: boolean }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);

  function load() {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => setTags(data.tags ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      load();
    }
  }

  async function remove(id: string) {
    setTags((t) => t.filter((tag) => tag.id !== id));
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    setPendingDelete(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etiketler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Görev, duyuru, tarih ve Atlas kayıtlarında ortak kullanılan etiketler.
        </p>

        {isAdmin && (
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Yeni etiket adı"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
            />
            <Button onClick={create} disabled={creating || !name.trim()}>
              Oluştur
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz etiket yok.</p>
            )}
            {tags.map((tag) => (
              <Badge key={tag.id} tone="slate" className="gap-1 pr-1">
                {tag.name}
                {isAdmin && (
                  <button
                    onClick={() => setPendingDelete(tag)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label={`${tag.name} etiketini sil`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        description={`"${pendingDelete?.name}" etiketini silmek istediğinize emin misiniz? Tüm kayıtlardan kaldırılır.`}
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
      />
    </Card>
  );
}
