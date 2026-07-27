"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Link2, Download, ExternalLink, Trash2, Upload, Plus, AtSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatFileSize } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface FileItem {
  id: string;
  kind: "UPLOAD" | "LINK";
  title: string | null;
  description: string | null;
  fileName: string | null;
  externalUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedById: string;
  uploadedBy: { id: string; name: string | null; email: string };
  university: { id: string; name: string } | null;
  mentions: { user: MemberOption }[];
}

export function FileManager({
  currentUserId,
  isAdmin,
  members,
}: {
  currentUserId: string;
  isAdmin: boolean;
  members: MemberOption[];
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<FileItem | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<"UPLOAD" | "LINK">("UPLOAD");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const router = useRouter();
  const searchParams = useSearchParams();

  function load() {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => setFiles(data.files ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Kullanıcı talebi: liste F5 atmadan gelsin.
  useLiveRefresh(load, 10000);

  // Bildirimden "direkt etiketlenen şeye git" (bkz. kullanıcı talebi #4):
  // `/files?open=<fileId>` ile gelindiğinde ilgili satıra kaydırılıp kısa
  // süreliğine vurgulanır. Dosyalar sayfası ayrı bir detay görünümüne sahip
  // olmadığından (tek liste), doğrudan navigasyon burada "scroll + highlight"
  // ile sağlanıyor.
  useEffect(() => {
    if (loading) return;
    const openId = searchParams.get("open");
    if (!openId) return;
    setHighlightId(openId);
    const el = rowRefs.current.get(openId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    router.replace("/files", { scroll: false });
    const timeout = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function resetForm() {
    setKind("UPLOAD");
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setSelectedFile(null);
    setMentionedUserIds(new Set());
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleMention(userId: string) {
    setMentionedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (kind === "UPLOAD" && !selectedFile) {
      setError("Lütfen bir dosya seçin.");
      return;
    }
    if (kind === "LINK" && !externalUrl.trim()) {
      setError("Lütfen bir bağlantı (URL) girin.");
      return;
    }
    if (kind === "LINK" && !title.trim()) {
      setError("Bağlantı için başlık girmeniz gerekir.");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("kind", kind);
    if (title.trim()) formData.append("title", title.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (kind === "LINK") formData.append("externalUrl", externalUrl.trim());
    if (kind === "UPLOAD" && selectedFile) formData.append("file", selectedFile);
    if (mentionedUserIds.size) {
      formData.append("mentionedUserIds", JSON.stringify(Array.from(mentionedUserIds)));
    }

    const res = await fetch("/api/files", { method: "POST", body: formData });
    setSaving(false);

    if (res.ok) {
      setModalOpen(false);
      resetForm();
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Dosya eklenemedi.");
    }
  }

  async function remove(id: string) {
    setFiles((f) => f.filter((file) => file.id !== id));
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    setPendingDelete(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button type="button" onClick={openModal}>
          <Plus className="mr-1.5 h-4 w-4" />
          Dosya Ekle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tüm Dosyalar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz dosya eklenmemiş. Başlamak için &ldquo;Dosya Ekle&rdquo;yi kullanın.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {files.map((file) => {
                const displayTitle = file.title || file.fileName || file.externalUrl || "İsimsiz";
                return (
                  <div
                    key={file.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(file.id, el);
                      else rowRefs.current.delete(file.id);
                    }}
                    className={`flex items-start justify-between gap-3 rounded-md py-3 transition-colors ${
                      highlightId === file.id ? "bg-primary/10 ring-1 ring-primary/40" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {file.kind === "LINK" ? (
                        <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{displayTitle}</p>
                        {file.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {file.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {file.kind === "UPLOAD" && file.fileSize != null
                            ? `${formatFileSize(file.fileSize)} · `
                            : ""}
                          {file.uploadedBy.name || file.uploadedBy.email} ·{" "}
                          {formatDate(file.createdAt)}
                          {file.university ? ` · ${file.university.name}` : ""}
                        </p>
                        {file.mentions.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {file.mentions.map(({ user }) => (
                              <Badge key={user.id} tone="slate" className="gap-1">
                                <AtSign className="h-3 w-3" />
                                {user.name || user.email}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {file.kind === "LINK" ? (
                        <a
                          href={file.externalUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={`${displayTitle} bağlantısını aç`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <a
                          href={`/api/files/${file.id}/download`}
                          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label={`${displayTitle} dosyasını indir`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {(isAdmin || file.uploadedById === currentUserId) && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(file)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                          aria-label={`${displayTitle} dosyasını sil`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Dosya Ekle">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Tür</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("UPLOAD")}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === "UPLOAD"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/80 hover:border-primary/50"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                Dosya Yükle
              </button>
              <button
                type="button"
                onClick={() => setKind("LINK")}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === "LINK"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground/80 hover:border-primary/50"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Bağlantı (URL)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Başlık{kind === "LINK" ? "" : " (opsiyonel)"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "LINK" ? "Örn. Kabul Mektubu Şablonu" : "Boşsa dosya adı kullanılır"}
              required={kind === "LINK"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Açıklama (opsiyonel)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu dosya/bağlantı hakkında kısa bir not"
            />
          </div>

          {kind === "UPLOAD" ? (
            <div className="space-y-1.5">
              <Label>Dosya</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {selectedFile ? selectedFile.name : "Dosya Seç"}
              </Button>
              <p className="text-xs text-muted-foreground">Maksimum dosya boyutu 25 MB.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Bağlantı</Label>
              <Input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kişi Etiketle (opsiyonel)</Label>
            <p className="text-xs text-muted-foreground">
              Seçilen kişiler bu dosyayı görebilir ve bildirim alır. Kimse seçilmezse bu dosya
              yalnızca size görünür.
            </p>
            {members.filter((m) => m.id !== currentUserId).length === 0 ? (
              <p className="text-xs text-muted-foreground">Ekipte başka üye yok.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {members
                  .filter((m) => m.id !== currentUserId)
                  .map((member) => {
                    const active = mentionedUserIds.has(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMention(member.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Ekleniyor..." : "Ekle"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        description={`"${pendingDelete?.title || pendingDelete?.fileName || pendingDelete?.externalUrl}" dosyasını silmek istediğinize emin misiniz?`}
        onConfirm={() => pendingDelete && remove(pendingDelete.id)}
      />
    </div>
  );
}
