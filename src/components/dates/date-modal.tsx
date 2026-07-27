"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SimpleSelect } from "@/components/ui/simple-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface University {
  id: string;
  name: string;
}

interface DateType {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface ImportantDateDetail {
  id: string;
  universityId: string;
  typeId: string;
  title: string;
  entryDate: string;
  date: string | null;
  description: string | null;
  createdBy: { id: string };
  mentions: { user: MemberOption }[];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateModal({
  open,
  onClose,
  onSaved,
  dateId,
  currentUserId,
  isAdmin,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  dateId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const isEdit = !!dateId;

  const [universities, setUniversities] = useState<University[]>([]);
  const [types, setTypes] = useState<DateType[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MemberOption[]>([]);
  const [pendingMentionIds, setPendingMentionIds] = useState<Set<string>>(new Set());
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/universities")
      .then((res) => res.json())
      .then((data) => setUniversities(data.universities ?? []));
    fetch("/api/date-types")
      .then((res) => res.json())
      .then((data) => setTypes(data.types ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!dateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUniversityId("");
      setTypeId("");
      setTitle("");
      setEntryDate(todayIso());
      setEndDate("");
      setDescription("");
      setMentionedUsers([]);
      setCreatedById(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/dates/${dateId}`)
      .then((res) => res.json())
      .then((data) => {
        const d: ImportantDateDetail = data.date;
        setUniversityId(d.universityId);
        setTypeId(d.typeId);
        setTitle(d.title);
        setEntryDate(d.entryDate.slice(0, 10));
        setEndDate(d.date ? d.date.slice(0, 10) : "");
        setDescription(d.description ?? "");
        setMentionedUsers(d.mentions.map((m) => m.user));
        setCreatedById(d.createdBy.id);
      })
      .finally(() => setLoading(false));
  }, [open, dateId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!universityId || !typeId) {
      setError("Lütfen üniversite ve tür seçin.");
      return;
    }
    if (!entryDate) {
      setError("Lütfen giriş tarihi seçin.");
      return;
    }

    setSaving(true);

    const payload = {
      universityId,
      typeId,
      title,
      entryDate,
      date: endDate || null,
      description: description || null,
    };

    const res = await fetch(isEdit ? `/api/dates/${dateId}` : "/api/dates", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Tarih kaydedilemedi.");
      return;
    }

    onSaved();
    onClose();
  }

  async function toggleMention(member: MemberOption) {
    if (!dateId) return;
    if (pendingMentionIds.has(member.id)) return;
    const isMentioned = mentionedUsers.some((m) => m.id === member.id);
    setPendingMentionIds((s) => new Set(s).add(member.id));
    try {
      if (isMentioned) {
        setMentionedUsers((m) => m.filter((u) => u.id !== member.id));
        await fetch(`/api/dates/${dateId}/mentions/${member.id}`, { method: "DELETE" });
      } else {
        setMentionedUsers((m) => [...m, member]);
        await fetch(`/api/dates/${dateId}/mentions`, {
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

  async function deleteDate() {
    if (!dateId) return;
    await fetch(`/api/dates/${dateId}`, { method: "DELETE" });
    setConfirmDeleteOpen(false);
    onSaved();
    onClose();
  }

  const canManage = !isEdit || isAdmin || createdById === currentUserId;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Tarihi Düzenle" : "Yeni Tarih"} wide>
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
            <div className="space-y-1.5">
              <Label>Başlık</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Giriş Tarihi</Label>
                <DatePicker value={entryDate} onChange={setEntryDate} disabled={!canManage} />
                <p className="text-[11px] text-muted-foreground">Bu kaydı bugün mü giriyorsunuz?</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bitiş Tarihi</Label>
                <div className="flex items-center gap-1.5">
                  <DatePicker value={endDate} onChange={setEndDate} disabled={!canManage} placeholder="Henüz belirlenmedi" />
                  {endDate && canManage && (
                    <button
                      type="button"
                      onClick={() => setEndDate("")}
                      aria-label="Bitiş tarihini temizle"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Henüz bilinmiyorsa boş bırakın, sonra eklenebilir.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Üniversite</Label>
                <Combobox
                  value={universityId}
                  onChange={setUniversityId}
                  options={universities.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="Seçin..."
                  searchPlaceholder="Üniversite ara..."
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tür</Label>
                <SimpleSelect
                  value={typeId}
                  onValueChange={setTypeId}
                  disabled={!canManage}
                  placeholder="Seçin..."
                  options={types.map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canManage}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {isEdit && canManage ? (
                <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                  Kaydı Sil
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {canManage ? "Vazgeç" : "Kapat"}
                </Button>
                {canManage && (
                  <Button type="submit" disabled={saving}>
                    {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
                  </Button>
                )}
              </div>
            </div>
          </form>

          {isEdit && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Kişi Etiketle</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Seçilen kişilere bu tarih kaydı için bildirim gönderilir.
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
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        description="Bu tarih kaydını silmek istediğinize emin misiniz?"
        onConfirm={deleteDate}
      />
    </Modal>
  );
}
