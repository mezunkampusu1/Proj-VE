"use client";

import { useEffect, useState } from "react";
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

interface AnnouncementType {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface AnnouncementDetail {
  id: string;
  universityId: string;
  typeId: string;
  title: string;
  entryDate: string;
  description: string | null;
  sourceUrl: string | null;
  createdBy: { id: string };
  mentions: { user: MemberOption }[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AnnouncementModal({
  open,
  onClose,
  onSaved,
  announcementId,
  currentUserId,
  isAdmin,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  announcementId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const isEdit = !!announcementId;

  const [universities, setUniversities] = useState<University[]>([]);
  const [types, setTypes] = useState<AnnouncementType[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
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
    fetch("/api/announcement-types")
      .then((res) => res.json())
      .then((data) => setTypes(data.types ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!announcementId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUniversityId("");
      setTypeId("");
      setTitle("");
      setEntryDate(todayIso());
      setDescription("");
      setSourceUrl("");
      setMentionedUsers([]);
      setCreatedById(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetch(`/api/announcements/${announcementId}`)
      .then((res) => res.json())
      .then((data) => {
        const a: AnnouncementDetail = data.announcement;
        setUniversityId(a.universityId);
        setTypeId(a.typeId);
        setTitle(a.title);
        setEntryDate(a.entryDate.slice(0, 10));
        setDescription(a.description ?? "");
        setSourceUrl(a.sourceUrl ?? "");
        setMentionedUsers(a.mentions.map((m) => m.user));
        setCreatedById(a.createdBy.id);
      })
      .finally(() => setLoading(false));
  }, [open, announcementId]);

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
      description: description || null,
      sourceUrl: sourceUrl || null,
    };

    const res = await fetch(
      isEdit ? `/api/announcements/${announcementId}` : "/api/announcements",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Duyuru kaydedilemedi.");
      return;
    }

    onSaved();
    onClose();
  }

  async function toggleMention(member: MemberOption) {
    if (!announcementId) return;
    // Aynı kişi için istek zaten devam ediyorsa yeni tıklamayı yok say —
    // buton devre dışı bırakıldığı için normalde tıklanamaz ama savunma
    // amaçlı burada da engelleniyor (çift bildirim bug'ının kök nedeni:
    // hızlı çift tıklama, istek tamamlanmadan ikinci bir POST tetikliyordu).
    if (pendingMentionIds.has(member.id)) return;
    const isMentioned = mentionedUsers.some((m) => m.id === member.id);
    setPendingMentionIds((s) => new Set(s).add(member.id));
    try {
      if (isMentioned) {
        setMentionedUsers((m) => m.filter((u) => u.id !== member.id));
        await fetch(`/api/announcements/${announcementId}/mentions/${member.id}`, { method: "DELETE" });
      } else {
        setMentionedUsers((m) => [...m, member]);
        await fetch(`/api/announcements/${announcementId}/mentions`, {
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

  async function deleteAnnouncement() {
    if (!announcementId) return;
    await fetch(`/api/announcements/${announcementId}`, { method: "DELETE" });
    setConfirmDeleteOpen(false);
    onSaved();
    onClose();
  }

  const canManage = !isEdit || isAdmin || createdById === currentUserId;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Duyuruyu Düzenle" : "Yeni Duyuru"} wide>
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
                <Label>Başlık</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Giriş Tarihi</Label>
                <DatePicker value={entryDate} onChange={setEntryDate} disabled={!canManage} />
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
            <div className="space-y-1.5">
              <Label>Kaynak Bağlantı</Label>
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                disabled={!canManage}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {isEdit && canManage ? (
                <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                  Duyuruyu Sil
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
                Seçilen kişilere bu duyuru için bildirim gönderilir.
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
        description="Bu duyuruyu silmek istediğinize emin misiniz?"
        onConfirm={deleteAnnouncement}
      />
    </Modal>
  );
}
