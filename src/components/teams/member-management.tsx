"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { roleLabel } from "@/lib/utils";

interface Member {
  id: string;
  role: "ADMIN" | "MEMBER";
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  token: string;
}

export function MemberManagement({
  teamId,
  members,
  invites,
  isAdmin,
}: {
  teamId: string;
  members: Member[];
  invites: Invite[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteLink(null);

    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Davet gönderilemedi.");
      return;
    }

    const data = await res.json();
    if (data.invite) {
      setInviteLink(`${window.location.origin}/invite/${data.invite.token}`);
    }
    setEmail("");
    router.refresh();
  }

  async function changeRole(memberId: string, newRole: "ADMIN" | "MEMBER") {
    await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
    setPendingRemove(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Üye Davet Et</h2>
          <form onSubmit={onInvite} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">E-posta</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="uye@mezunkampusu.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rol</Label>
              <SimpleSelect
                value={role}
                onValueChange={(v) => setRole(v as "ADMIN" | "MEMBER")}
                options={[
                  { value: "MEMBER", label: "Ekip Üyesi" },
                  { value: "ADMIN", label: "Yönetici" },
                ]}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Gönderiliyor..." : "Davet Et"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          {inviteLink && (
            <p className="mt-2 text-sm text-muted-foreground">
              Kullanıcı sistemde kayıtlı değil. Bu bağlantıyı paylaşın:{" "}
              <code className="break-all rounded bg-secondary px-1.5 py-0.5 text-xs">
                {inviteLink}
              </code>
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          Üyeler ({members.length})
        </h2>
        <div className="divide-y divide-border">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.user.name} email={m.user.email} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.user.name || m.user.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <SimpleSelect
                    value={m.role}
                    onValueChange={(v) => changeRole(m.id, v as "ADMIN" | "MEMBER")}
                    triggerClassName="w-36"
                    options={[
                      { value: "MEMBER", label: "Ekip Üyesi" },
                      { value: "ADMIN", label: "Yönetici" },
                    ]}
                  />
                  <Button variant="danger" size="sm" onClick={() => setPendingRemove(m)}>
                    Çıkar
                  </Button>
                </div>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">{roleLabel(m.role)}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isAdmin && invites.length > 0 && (
        <Card>
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
            Bekleyen Davetler
          </h2>
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-foreground/90">{invite.email}</span>
                <span className="text-xs text-muted-foreground">{roleLabel(invite.role)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        description={`"${pendingRemove?.user.name || pendingRemove?.user.email}" kullanıcısını ekipten çıkarmak istediğinize emin misiniz?`}
        onConfirm={() => pendingRemove && removeMember(pendingRemove.id)}
      />
    </div>
  );
}
