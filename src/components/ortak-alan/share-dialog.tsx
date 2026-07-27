"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentAccessLevelLabel } from "@/lib/utils";
import { toast } from "sonner";
import type { TeamMemberOption } from "@/components/kanban/types";

interface PermissionRow {
  id: string;
  subjectType: "USER" | "TEAM" | "ROLE" | "EVERYONE";
  level: "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";
  subjectUser: { id: string; name: string | null; email: string } | null;
  subjectRole: "ADMIN" | "MEMBER" | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  documentId: string;
  teamId: string;
  canManage: boolean;
}

const LEVELS = ["VIEWER", "COMMENTER", "EDITOR"] as const;

function subjectLabel(perm: PermissionRow): string {
  if (perm.subjectType === "USER") return perm.subjectUser?.name || perm.subjectUser?.email || "Kullanıcı";
  if (perm.subjectType === "ROLE") return perm.subjectRole === "ADMIN" ? "Tüm Yöneticiler" : "Tüm Üyeler";
  if (perm.subjectType === "TEAM") return "Tüm Ekip";
  return "Herkes (ekip içi)";
}

/**
 * Paylaşım modalı: mevcut yetkiler (kullanıcı/rol/herkes) + dış bağlantı
 * paylaşımı (§10 + §22) tek yerde. §143'te yalnızca API inşa edilmişti;
 * bu görev o boşluğu da kapatıyor.
 */
export function ShareDialog({ open, onClose, documentId, teamId, canManage }: Props) {
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<(typeof LEVELS)[number]>("VIEWER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareHasPassword, setShareHasPassword] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<string>("");
  const [linkPassword, setLinkPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [docRes, membersRes] = await Promise.all([
        fetch(`/api/documents/${documentId}`),
        fetch(`/api/teams/${teamId}/members`),
      ]);
      const docJson = await docRes.json();
      const membersJson = await membersRes.json();
      setPermissions(docJson.document?.permissions ?? []);
      setShareToken(docJson.document?.publicShareToken ?? null);
      setShareHasPassword(!!docJson.document?.publicSharePasswordHash);
      setMembers((membersJson.members ?? []).map((m: { user: TeamMemberOption }) => m.user));
    } catch {
      toast.error("Paylaşım bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  const grantUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: "USER", subjectUserId: selectedUserId, level: selectedLevel }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error);
      }
      setSelectedUserId("");
      toast.success("Paylaşıldı.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Paylaşılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const grantEveryone = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType: "EVERYONE", level: selectedLevel }),
      });
      if (!res.ok) throw new Error();
      toast.success("Tüm ekiple paylaşıldı.");
      await load();
    } catch {
      toast.error("Paylaşılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (permissionId: string) => {
    setPermissions((rows) => rows.filter((r) => r.id !== permissionId));
    try {
      const res = await fetch(`/api/documents/${documentId}/permissions/${permissionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Kaldırılamadı.");
      load();
    }
  };

  const createShareLink = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInHours: expiresInHours ? Number(expiresInHours) : null,
          password: linkPassword || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShareToken(json.token);
      setShareHasPassword(json.hasPassword);
      toast.success("Bağlantı oluşturuldu.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Bağlantı oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const revokeShareLink = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/share-link`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setShareToken(null);
      setShareHasPassword(false);
      toast.success("Bağlantı kaldırıldı.");
    } catch {
      toast.error("Bağlantı kaldırılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Bağlantı kopyalandı.");
  };

  const availableMembers = members.filter((m) => !permissions.some((p) => p.subjectUser?.id === m.id));

  return (
    <Modal open={open} onClose={onClose} title="Paylaş" wide>
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>
      ) : (
        <div className="space-y-5">
          {canManage && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Kişi veya rol ekle
              </p>
              <div className="flex gap-1.5">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Kişi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as typeof selectedLevel)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {documentAccessLevelLabel(l)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!selectedUserId || saving} onClick={grantUser}>
                  Ekle
                </Button>
              </div>
              <Button size="sm" variant="secondary" disabled={saving} onClick={grantEveryone}>
                Tüm ekiple paylaş ({documentAccessLevelLabel(selectedLevel)})
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Erişimi olanlar</p>
            {permissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Henüz özel bir paylaşım yok.</p>
            ) : (
              <div className="space-y-1">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-sm">
                    <span className="text-foreground">{subjectLabel(perm)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{documentAccessLevelLabel(perm.level)}</span>
                      {canManage && (
                        <button onClick={() => revoke(perm.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> Dış bağlantı paylaşımı
              </p>
              {shareToken ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`} className="text-xs" />
                    <Button size="icon" variant="secondary" onClick={copyLink} title="Kopyala">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{shareHasPassword ? "Şifreli" : "Şifresiz"} — ekip dışından erişilebilir.</p>
                  <Button size="sm" variant="danger" disabled={saving} onClick={revokeShareLink}>
                    Bağlantıyı Kaldır
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(e.target.value)}
                      placeholder="Süre (saat, boş=süresiz)"
                      className="text-xs"
                    />
                    <Input
                      type="password"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder="Şifre (opsiyonel)"
                      className="text-xs"
                    />
                  </div>
                  <Button size="sm" disabled={saving} onClick={createShareLink}>
                    Bağlantı Oluştur
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
