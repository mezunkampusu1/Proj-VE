"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Pin } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

export function CreateProjectButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"DATED" | "FIXED">("DATED");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kullanıcı talebi #6 (netleştirilmiş): "kimler etiketlenecek" sorusu
  // görev oluşturmada değil, TAM OLARAK burada — "Yeni Proje Oluştur"
  // adımında sorulmalı (bkz. new-document-dialog.tsx ile AYNI desen).
  useEffect(() => {
    if (!open) return;
    fetch(`/api/teams/${teamId}/members`)
      .then((r) => r.json())
      .then((json) => setMembers(json.members?.map((m: { user: MemberOption }) => m.user) ?? json.members ?? []))
      .catch(() => {});
  }, [open, teamId]);

  function toggleMember(userId: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/teams/${teamId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        kind,
        memberIds: Array.from(memberIds),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Proje oluşturulamadı.");
      return;
    }

    const { project } = await res.json();
    setOpen(false);
    setName("");
    setDescription("");
    setKind("DATED");
    setMemberIds(new Set());
    router.push(`/teams/${teamId}/projects/${project.id}`);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Yeni Proje</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Yeni Proje Oluştur">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-1.5">
            <Label>Proje Adı</Label>
            <Input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Mobil Uygulama v2"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Açıklama (opsiyonel)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Projenin kısa açıklaması"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pano Türü</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("DATED")}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === "DATED"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/80 hover:border-primary/50"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Günlük Plan
              </button>
              <button
                type="button"
                onClick={() => setKind("FIXED")}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === "FIXED"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/80 hover:border-primary/50"
                }`}
              >
                <Pin className="h-3.5 w-3.5" />
                Sabit
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {kind === "DATED"
                ? "Gün gezinmeli pano — görevler bir tarihe bağlıdır, gün değişince değişir (bkz. mevcut Görevler panoları)."
                : "Trello tarzı sabit pano — tarih/gün gezinmesi olmaz, tüm görevler her zaman görünür, görev bazlı ilerlenir."}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Kişi Etiketle (opsiyonel)</Label>
            <p className="text-xs text-muted-foreground">
              Seçilen kişiler bu projeyi görüp içinde çalışabilir. Kimse seçilmezse bu proje
              yalnızca size görünür.
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ekipte başka üye yok.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {members.map((member) => {
                  const active = memberIds.has(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground/80 hover:border-primary/50",
                      )}
                    >
                      <Avatar name={member.name} email={member.email} size={18} />
                      {member.name || member.email}
                    </button>
                  );
                })}
              </div>
            )}
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
