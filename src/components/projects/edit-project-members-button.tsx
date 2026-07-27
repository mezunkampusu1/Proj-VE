"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  projectId: string;
  initialMemberIds: string[];
}

/**
 * Kullanıcı talebi: "kişiyi en baştan etiketlemedim ya da gruba sonradan
 * dahil oldu, sonradan etiketleyebileyim" — proje oluşturmada sorulan
 * "Kişi Etiketle" (bkz. create-project-form.tsx) artık oluşturulmuş bir
 * projede de SONRADAN değiştirilebiliyor. Yalnızca oluşturan veya admin bu
 * butonu görür (bkz. requireProjectAccess ile AYNI kısıtlama, backend'de
 * PATCH /api/projects/[projectId] tarafında da tekrar doğrulanıyor).
 */
export function EditProjectMembersButton({ projectId, initialMemberIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(initialMemberIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMemberIds(new Set(initialMemberIds));
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((json) => {
        const teamMembers = json.project?.team?.members?.map((m: { user: MemberOption }) => m.user) ?? [];
        setMembers(teamMembers);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  function toggleMember(userId: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: Array.from(memberIds) }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Kişi etiketleri kaydedilemedi.");
      return;
    }
    setOpen(false);
    toast.success("Kişi etiketleri güncellendi.");
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Users className="mr-1.5 h-3.5 w-3.5" />
        Kişi Etiketle
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Kişi Etiketle">
        <div className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Kişi Etiketle (opsiyonel)</Label>
            <p className="text-xs text-muted-foreground">
              Seçilen kişiler bu projeyi görüp içinde çalışabilir. Kimse seçilmezse bu proje
              yalnızca size görünür. Sonradan gruba katılan biri varsa buradan ekleyebilirsiniz.
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
            <Button type="button" disabled={saving} onClick={onSave}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
