"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Ban, Send, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface ApprovalUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface ApprovalRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "WITHDRAWN";
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: ApprovalUser;
  currentApprover: ApprovalUser | null;
  decidedBy: ApprovalUser | null;
}

interface Props {
  documentId: string;
  currentUserId: string;
  isAdmin: boolean;
  canEdit: boolean;
  onDocumentStatusChanged?: (status: string) => void;
}

const STATUS_META: Record<ApprovalRequest["status"], { label: string; className: string }> = {
  PENDING: { label: "Onay bekliyor", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  APPROVED: { label: "Onaylandı", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  REVISION_REQUESTED: { label: "Revizyon istendi", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  REJECTED: { label: "Reddedildi", className: "bg-destructive/15 text-destructive" },
  WITHDRAWN: { label: "Geri çekildi", className: "bg-secondary text-muted-foreground" },
};

/**
 * Onay akışı paneli (§15). Bu projede ayrı bir "takım yöneticisi" rolü
 * bulunmadığından spesifikasyondaki iki aşamalı (yönetici → admin) yapı
 * tek aşamaya indirgendi: herhangi bir ADMIN karar verebilir. Editör/sahip
 * dokümanı onaya gönderebilir ve kendi bekleyen talebini geri çekebilir.
 */
export function ApprovalPanel({ documentId, currentUserId, isAdmin, canEdit, onDocumentStatusChanged }: Props) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // "Onaya gönder" ne anlama geliyor, kime gidiyor belirsizdi (bkz. görev
  // #193: kullanıcı "neyi onaya gönderiyor göremiyoruz" diye bildirdi).
  // Backend her zaman TÜM ekip yöneticilerine (ADMIN rolü) bildirim
  // gönderiyor — spesifik bir onaylayan SEÇME UI'ı hiç yoktu (bkz.
  // approval/route.ts: currentApproverId belirtilmezse tüm adminlere
  // gider). Bu isimleri gösterip düğmenin ne yapacağını netleştiriyoruz.
  const [admins, setAdmins] = useState<ApprovalUser[]>([]);

  const load = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/approval`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRequests(json.requests ?? []);
    } catch {
      toast.error("Onay geçmişi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const docRes = await fetch(`/api/documents/${documentId}`);
      const docJson = await docRes.json();
      const teamId = docJson?.document?.teamId;
      if (!teamId) return;
      const res = await fetch(`/api/teams/${teamId}/members`);
      const json = await res.json();
      const adminMembers = (json.members ?? []).filter(
        (m: { role: string }) => m.role === "ADMIN",
      );
      setAdmins(adminMembers.map((m: { user: ApprovalUser }) => m.user));
    } catch {
      // Sessizce yoksay — bu yalnızca bilgilendirme amaçlı, akışı bloklamaz.
    }
  };

  useEffect(() => {
    load();
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const pending = requests.find((r) => r.status === "PENDING");

  const submitForApproval = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error);
      }
      toast.success("Doküman onaya gönderildi.");
      onDocumentStatusChanged?.("PENDING_APPROVAL");
      await load();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Onaya gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (approvalId: string, decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "WITHDRAWN") => {
    const note = noteDrafts[approvalId]?.trim();
    if (decision === "REVISION_REQUESTED" && !note) {
      toast.error("Revizyon talep ederken açıklama zorunludur.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/approval/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error);
      }
      const statusMap: Record<string, string> = {
        APPROVED: "APPROVED",
        REVISION_REQUESTED: "BEING_REVISED",
        REJECTED: "DRAFT",
        WITHDRAWN: "DRAFT",
      };
      onDocumentStatusChanged?.(statusMap[decision]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "İşlem başarısız oldu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        {pending ? (
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_META.PENDING.className)}>
                {STATUS_META.PENDING.label}
              </span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(pending.createdAt), { addSuffix: true, locale: tr })}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {pending.requestedBy.name || pending.requestedBy.email} tarafından gönderildi.
            </p>
            {!isAdmin && (
              <p className="mt-1 text-muted-foreground">
                {admins.length > 0
                  ? `Karar bekleniyor: ${admins.map((a) => a.name || a.email).join(", ")}.`
                  : "Bu ekipte karar verebilecek bir yönetici bulunmuyor."}
              </p>
            )}

            {isAdmin && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={noteDrafts[pending.id] ?? ""}
                  onChange={(e) => setNoteDrafts((s) => ({ ...s, [pending.id]: e.target.value }))}
                  placeholder="Açıklama (revizyon için zorunlu)"
                  className="min-h-[60px] text-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" disabled={submitting} onClick={() => decide(pending.id, "APPROVED")}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Onayla
                  </Button>
                  <Button size="sm" variant="secondary" disabled={submitting} onClick={() => decide(pending.id, "REVISION_REQUESTED")}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Revizyon iste
                  </Button>
                  <Button size="sm" variant="danger" disabled={submitting} onClick={() => decide(pending.id, "REJECTED")}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reddet
                  </Button>
                </div>
              </div>
            )}

            {!isAdmin && pending.requestedBy.id === currentUserId && (
              <Button size="sm" variant="ghost" className="mt-3" disabled={submitting} onClick={() => decide(pending.id, "WITHDRAWN")}>
                <Ban className="mr-1 h-3.5 w-3.5" /> Talebi geri çek
              </Button>
            )}
          </div>
        ) : canEdit ? (
          <div className="space-y-2">
            <div className="flex gap-1.5 rounded-lg bg-secondary/40 p-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Dokümanın şu anki hali incelenmek üzere gönderilir; durumu &quot;Onay Bekliyor&quot; olarak
                işaretlenir.{" "}
                {admins.length > 0 ? (
                  <>
                    Şu yöneticilere bildirim gider: <strong>{admins.map((a) => a.name || a.email).join(", ")}</strong>.
                  </>
                ) : (
                  "Bu ekipte karar verebilecek bir yönetici bulunmuyor — gönderirseniz kimse bildirim almaz."
                )}
              </p>
            </div>
            <Button size="sm" className="w-full" disabled={submitting} onClick={submitForApproval}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Onaya gönder
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Bekleyen bir onay talebi yok.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Geçmiş</p>
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz onay talebi oluşturulmamış.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_META[r.status].className)}>
                    {STATUS_META[r.status].label}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: tr })}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {r.requestedBy.name || r.requestedBy.email} gönderdi
                  {r.decidedBy ? `, ${r.decidedBy.name || r.decidedBy.email} karar verdi` : ""}.
                </p>
                {r.decisionNote && <p className="mt-1 rounded-md bg-secondary/50 p-1.5">{r.decisionNote}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
