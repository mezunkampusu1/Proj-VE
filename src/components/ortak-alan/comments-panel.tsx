"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, CheckCircle2, RotateCcw, Trash2, ListPlus, Pencil, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput, MentionText } from "@/components/kanban/mention-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import type { TeamMemberOption } from "@/components/kanban/types";

interface CommentAuthor {
  id: string;
  name: string | null;
  email: string;
}

interface DocumentComment {
  id: string;
  body: string;
  authorId: string;
  author: CommentAuthor;
  resolved: boolean;
  resolvedBy?: { id: string; name: string | null } | null;
  createdAt: string;
  parentCommentId: string | null;
  replies?: DocumentComment[];
}

interface Props {
  documentId: string;
  teamId: string;
  currentUserId: string;
  canComment: boolean;
}

/**
 * Sağ panel — metin seçimine bağlı olmayan genel yorum akışı (spesifikasyon
 * §5). Metne çapalanmış (anchorFrom/anchorTo) yorumlar için editör
 * içinden aynı API'ler `anchorFrom`/`anchorTo`/`anchorText` ile
 * çağrılabilir — bu panel her iki tür yorumu da aynı listede gösterir.
 */
export function CommentsPanel({ documentId, teamId, currentUserId, canComment }: Props) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [newBody, setNewBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === "all" ? "" : filter === "resolved" ? "?resolved=1" : "?resolved=0";
      const res = await fetch(`/api/documents/${documentId}/comments${query}`);
      const data = await res.json();
      setComments(data.comments || []);
    } finally {
      setLoading(false);
    }
  }, [documentId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers((data.members || []).map((m: { user: TeamMemberOption }) => m.user));
      })
      .catch(() => {});
  }, [teamId]);

  const submitComment = async (body: string, parentCommentId?: string) => {
    if (!body.trim()) return;
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentCommentId }),
    });
    if (!res.ok) {
      toast.error("Yorum eklenemedi.");
      return;
    }
    const data = await res.json();
    if (data.mentionWarnings?.length) {
      toast.warning(`Şu kişilerin dokümana erişimi yok: ${data.mentionWarnings.join(", ")}`);
    }
    setNewBody("");
    setReplyBody("");
    setReplyTo(null);
    load();
  };

  const toggleResolved = async (comment: DocumentComment) => {
    const res = await fetch(`/api/documents/${documentId}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !comment.resolved }),
    });
    if (!res.ok) {
      toast.error("İşlem başarısız.");
      return;
    }
    load();
  };

  const saveEdit = async (commentId: string) => {
    const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    if (!res.ok) {
      toast.error("Yorum güncellenemedi.");
      return;
    }
    setEditingId(null);
    load();
  };

  const deleteComment = async (commentId: string) => {
    const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Yorum silinemedi.");
      return;
    }
    load();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="h-4 w-4" />
          Yorumlar
        </div>
        <div className="flex gap-1">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              {f === "open" ? "Açık" : f === "resolved" ? "Çözüldü" : "Tümü"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz yorum yok.</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-border bg-secondary/30 p-3">
            <CommentRow
              comment={comment}
              currentUserId={currentUserId}
              editing={editingId === comment.id}
              editBody={editBody}
              members={members}
              onStartEdit={() => {
                setEditingId(comment.id);
                setEditBody(comment.body);
              }}
              onCancelEdit={() => setEditingId(null)}
              onEditBodyChange={setEditBody}
              onSaveEdit={() => saveEdit(comment.id)}
              onToggleResolved={() => toggleResolved(comment)}
              onDelete={() => deleteComment(comment.id)}
              onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              documentId={documentId}
            />

            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-2 space-y-2 border-l border-border pl-3">
                {comment.replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    editing={editingId === reply.id}
                    editBody={editBody}
                    members={members}
                    onStartEdit={() => {
                      setEditingId(reply.id);
                      setEditBody(reply.body);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onEditBodyChange={setEditBody}
                    onSaveEdit={() => saveEdit(reply.id)}
                    onToggleResolved={() => toggleResolved(reply)}
                    onDelete={() => deleteComment(reply.id)}
                    documentId={documentId}
                    isReply
                  />
                ))}
              </div>
            )}

            {canComment && replyTo === comment.id && (
              <div className="mt-2 space-y-1.5">
                <MentionInput
                  value={replyBody}
                  onChange={setReplyBody}
                  members={members}
                  placeholder="Yanıtla… (@ ile etiketleyin)"
                  rows={2}
                  onEnterSubmit={() => submitComment(replyBody, comment.id)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                    Vazgeç
                  </Button>
                  <Button size="sm" onClick={() => submitComment(replyBody, comment.id)}>
                    Yanıtla
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {canComment && (
        <div className="space-y-1.5 border-t border-border px-4 py-3">
          <MentionInput
            value={newBody}
            onChange={setNewBody}
            members={members}
            placeholder="Yorum ekleyin… (@ ile etiketleyin)"
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => submitComment(newBody)}>
              Yorum Ekle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  editing,
  editBody,
  members,
  onStartEdit,
  onCancelEdit,
  onEditBodyChange,
  onSaveEdit,
  onToggleResolved,
  onDelete,
  onReply,
  documentId,
  isReply,
}: {
  comment: DocumentComment;
  currentUserId: string;
  editing: boolean;
  editBody: string;
  members: TeamMemberOption[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditBodyChange: (v: string) => void;
  onSaveEdit: () => void;
  onToggleResolved: () => void;
  onDelete: () => void;
  onReply?: () => void;
  documentId: string;
  isReply?: boolean;
}) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const isOwn = comment.authorId === currentUserId;

  return (
    <div>
      <div className="flex items-start gap-2">
        <Avatar name={comment.author.name} email={comment.author.email} size={24} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {comment.author.name || comment.author.email}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
            {comment.resolved && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                Çözüldü
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-1 space-y-1.5">
              <MentionInput
                value={editBody}
                onChange={onEditBodyChange}
                members={members}
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Vazgeç
                </Button>
                <Button size="sm" onClick={onSaveEdit}>
                  Kaydet
                </Button>
              </div>
            </div>
          ) : (
            <MentionText body={comment.body} className="mt-0.5 text-sm text-foreground/90" />
          )}

          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {!isReply && onReply && (
                <button onClick={onReply} className="hover:text-foreground">
                  Yanıtla
                </button>
              )}
              <button onClick={onToggleResolved} className="flex items-center gap-1 hover:text-foreground">
                {comment.resolved ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {comment.resolved ? "Yeniden Aç" : "Çözüldü İşaretle"}
              </button>
              {isOwn && (
                <button onClick={onStartEdit} className="flex items-center gap-1 hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                  Düzenle
                </button>
              )}
              <button onClick={onDelete} className="flex items-center gap-1 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
                Sil
              </button>
              <button onClick={() => setShowTaskForm((v) => !v)} className="flex items-center gap-1 hover:text-foreground">
                <ListPlus className="h-3 w-3" />
                Görev Oluştur
              </button>
            </div>
          )}

          {showTaskForm && (
            <CreateTaskFromComment
              documentId={documentId}
              commentId={comment.id}
              onClose={() => setShowTaskForm(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskFromComment({
  documentId,
  commentId,
  onClose,
}: {
  documentId: string;
  commentId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        const teamId = data?.document?.teamId;
        if (!teamId) return;
        return fetch(`/api/teams/${teamId}/projects`)
          .then((r) => r.json())
          .then((d) => setProjects(d.projects || []));
      })
      .catch(() => {});
  }, [documentId]);

  const submit = async () => {
    if (!title.trim() || !projectId) {
      toast.error("Görev başlığı ve proje seçimi gerekli.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments/${commentId}/create-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, projectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Görev oluşturulamadı.");
      toast.success("Görev oluşturuldu.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Yorumdan Görev Oluştur</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Görev başlığı"
        className="w-full rounded-lg border border-input bg-secondary/40 px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/50"
      />
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Proje seçin" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex justify-end">
        <Button size="sm" disabled={submitting} onClick={submit}>
          Oluştur
        </Button>
      </div>
    </div>
  );
}
