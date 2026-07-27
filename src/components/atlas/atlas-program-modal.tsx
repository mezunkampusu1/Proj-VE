"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, degreeLevelLabel, atlasFieldLabel } from "@/lib/utils";

interface Institute {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface ChangeLogEntry {
  id: string;
  action: "CREATED" | "UPDATED" | "REMOVED";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: { id: string; name: string | null; email: string };
}

interface AtlasProgramDetail {
  id: string;
  instituteId: string;
  name: string;
  degreeLevel: "YUKSEK_LISANS" | "DOKTORA";
  isActive: boolean;
  entryDate: string;
  createdBy: { id: string };
  mentions: { user: MemberOption }[];
  changeLogs: ChangeLogEntry[];
  institute: { id: string; name: string };
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function changeLogText(entry: ChangeLogEntry) {
  if (entry.action === "CREATED") return "Program oluşturuldu.";
  if (entry.field === "isActive") {
    return entry.newValue === "false" ? "Program pasifleştirildi." : "Program yeniden aktifleştirildi.";
  }
  if (entry.field === "degreeLevel") {
    return `Derece: ${degreeLevelLabel(entry.oldValue ?? "")} → ${degreeLevelLabel(entry.newValue ?? "")}`;
  }
  if (entry.field === "instituteId") {
    return "Enstitü değiştirildi.";
  }
  if (entry.field === "name") {
    return `Ad: "${entry.oldValue}" → "${entry.newValue}"`;
  }
  if (entry.field === "entryDate") {
    return `Giriş Tarihi: ${formatDate(entry.oldValue)} → ${formatDate(entry.newValue)}`;
  }
  return `${atlasFieldLabel(entry.field ?? "")} güncellendi.`;
}

export function AtlasProgramModal({
  open,
  onClose,
  onSaved,
  programId,
  currentUserId,
  isAdmin,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  programId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const isEdit = !!programId;

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [instituteId, setInstituteId] = useState("");
  const [name, setName] = useState("");
  const [degreeLevel, setDegreeLevel] = useState<"YUKSEK_LISANS" | "DOKTORA">("YUKSEK_LISANS");
  const [isActive, setIsActive] = useState(true);
  const [entryDate, setEntryDate] = useState(todayIso());
  const [mentionedUsers, setMentionedUsers] = useState<MemberOption[]>([]);
  const [pendingMentionIds, setPendingMentionIds] = useState<Set<string>>(new Set());
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/institutes")
      .then((res) => res.json())
      .then((data) => setInstitutes(data.institutes ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!programId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstituteId("");
      setName("");
      setDegreeLevel("YUKSEK_LISANS");
      setIsActive(true);
      setEntryDate(todayIso());
      setMentionedUsers([]);
      setChangeLogs([]);
      setCreatedById(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/atlas/programs/${programId}`)
      .then((res) => res.json())
      .then((data) => {
        const p: AtlasProgramDetail = data.program;
        setInstituteId(p.instituteId);
        setName(p.name);
        setDegreeLevel(p.degreeLevel);
        setIsActive(p.isActive);
        setEntryDate(p.entryDate.slice(0, 10));
        setMentionedUsers(p.mentions.map((m) => m.user));
        setChangeLogs(p.changeLogs);
        setCreatedById(p.createdBy.id);
      })
      .finally(() => setLoading(false));
  }, [open, programId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!instituteId) {
      setError("Lütfen enstitü seçin.");
      return;
    }
    if (!entryDate) {
      setError("Lütfen giriş tarihi seçin.");
      return;
    }

    setSaving(true);

    const payload = isEdit
      ? { instituteId, name, degreeLevel, isActive, entryDate }
      : { instituteId, name, degreeLevel, entryDate };

    const res = await fetch(isEdit ? `/api/atlas/programs/${programId}` : "/api/atlas/programs", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Program kaydedilemedi.");
      return;
    }

    onSaved();
    onClose();
  }

  async function toggleMention(member: MemberOption) {
    if (!programId) return;
    if (pendingMentionIds.has(member.id)) return;
    const isMentioned = mentionedUsers.some((m) => m.id === member.id);
    setPendingMentionIds((s) => new Set(s).add(member.id));
    try {
      if (isMentioned) {
        setMentionedUsers((m) => m.filter((u) => u.id !== member.id));
        await fetch(`/api/atlas/programs/${programId}/mentions/${member.id}`, { method: "DELETE" });
      } else {
        setMentionedUsers((m) => [...m, member]);
        await fetch(`/api/atlas/programs/${programId}/mentions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: member.id }),
        });
      }
    } finally {
      setPendingMentionIds((s) => {
        const next = new Set(s);
        next.delete(member.id);
        return next;
      });
    }
  }

  const canManage = !isEdit || isAdmin || createdById === currentUserId;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Programı Düzenle" : "Yeni Program"} wide>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
      ) : (
        <div className="space-y-5">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Program Adı</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Giriş Tarihi</Label>
                <DatePicker value={entryDate} onChange={setEntryDate} disabled={!canManage} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Enstitü</Label>
                <Combobox
                  value={instituteId}
                  onChange={setInstituteId}
                  options={institutes.map((i) => ({ value: i.id, label: i.name }))}
                  placeholder="Seçin..."
                  searchPlaceholder="Enstitü ara..."
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Derece</Label>
                <SimpleSelect
                  value={degreeLevel}
                  onValueChange={(v) => setDegreeLevel(v as "YUKSEK_LISANS" | "DOKTORA")}
                  disabled={!canManage}
                  options={[
                    { value: "YUKSEK_LISANS", label: "Yüksek Lisans" },
                    { value: "DOKTORA", label: "Doktora" },
                  ]}
                />
              </div>
            </div>
            {isEdit && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Durum</Label>
                  <SimpleSelect
                    value={isActive ? "1" : "0"}
                    onValueChange={(v) => setIsActive(v === "1")}
                    disabled={!canManage}
                    options={[
                      { value: "1", label: "Aktif" },
                      { value: "0", label: "Pasif" },
                    ]}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                {canManage ? "Vazgeç" : "Kapat"}
              </Button>
              {canManage && (
                <Button type="submit" disabled={saving}>
                  {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
                </Button>
              )}
            </div>
          </form>

          {isEdit && (
            <>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Kişi Etiketle</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seçilen kişilere bu program için bildirim gönderilir.
                </p>
                <div className="mt-2">
                  {members.filter((m) => m.id !== currentUserId).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ekipte başka üye yok.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {members
                        .filter((m) => m.id !== currentUserId)
                        .map((member) => {
                          const active = mentionedUsers.some((m) => m.id === member.id);
                          const isPending = pendingMentionIds.has(member.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              disabled={isPending}
                              onClick={() => toggleMention(member)}
                              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-foreground/80 hover:border-primary/50"
                              }`}
                            >
                              <Avatar name={member.name} email={member.email} size={18} />
                              {member.name || member.email}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Değişiklik Geçmişi</h3>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {changeLogs.map((log) => (
                    <div key={log.id} className="rounded-md bg-secondary/50 px-3 py-2 text-sm">
                      <p className="text-foreground/90">{changeLogText(log)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {log.changedBy.name || log.changedBy.email} · {formatDate(log.changedAt)}
                      </p>
                    </div>
                  ))}
                  {changeLogs.length === 0 && (
                    <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
