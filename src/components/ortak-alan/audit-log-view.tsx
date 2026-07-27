"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentAuditActionLabel } from "@/lib/utils";
import { toast } from "sonner";

interface AuditRow {
  id: string;
  documentId: string | null;
  documentTitleSnapshot: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string | null };
}

interface TeamMemberOption {
  user: { id: string; name: string | null; email: string | null };
}

const ACTION_OPTIONS = [
  "CREATED",
  "EDITED",
  "DELETED",
  "RESTORED",
  "PERMANENTLY_DELETED",
  "PERMISSION_GRANTED",
  "PERMISSION_REVOKED",
  "SHARED",
  "DOWNLOADED",
  "EXPORTED",
  "COMMENT_ADDED",
  "COMMENT_DELETED",
  "SUGGESTION_ACCEPTED",
  "SUGGESTION_REJECTED",
  "VERSION_RESTORED",
  "OWNER_CHANGED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "REVISION_REQUESTED",
  "APPROVAL_REJECTED",
  "APPROVAL_WITHDRAWN",
];

interface Props {
  teamId: string;
}

/** Ortak Alan denetim kaydı ekranı: filtrelenebilir, sayfalanabilir tam liste (§22, görev #160). */
export function AuditLogView({ teamId }: Props) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actorId, setActorId] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/teams/${teamId}/members`)
      .then((r) => r.json())
      .then((json) => setMembers(json.members ?? []))
      .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (actorId !== "all") params.set("actorId", actorId);
    if (action !== "all") params.set("action", action);
    if (q.trim()) params.set("q", q.trim());

    fetch(`/api/documents/admin/audit-log?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setLogs(json.logs ?? []);
        setTotal(json.total ?? 0);
        setHasMore(!!json.hasMore);
      })
      .catch(() => toast.error("Denetim kayıtları yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, actorId, action, q]);

  useEffect(() => setPage(1), [actorId, action, q]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Doküman adına göre ara…"
            className="max-w-xs"
          />
          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Kullanıcı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kullanıcılar</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name || m.user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Eylem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm eylemler</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {documentAuditActionLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{total} kayıt</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          {/* Revizyon: "yazılar yan yana geliyor" — hücrelere yatay
              boşluk (px) + dikey ortalama eklendi (bkz.
              activity-log-view.tsx'teki aynı düzeltme). */}
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 pl-0 font-medium">Zaman</th>
                <th className="px-3 py-2 font-medium">Kullanıcı</th>
                <th className="px-3 py-2 font-medium">Eylem</th>
                <th className="px-3 py-2 font-medium">Doküman</th>
                <th className="px-3 py-2 font-medium">Ayrıntı</th>
                <th className="px-3 py-2 pr-0 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 pl-0 align-middle text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-foreground">{log.actor.name || log.actor.email}</td>
                  <td className="px-3 py-2.5 align-middle text-muted-foreground">
                    {documentAuditActionLabel(log.action)}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {log.documentId ? (
                      <Link href={`/ortak-alan/${log.documentId}`} className="text-foreground hover:underline">
                        {log.documentTitleSnapshot}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{log.documentTitleSnapshot}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-xs text-muted-foreground">
                    {log.description ||
                      (log.field ? `${log.field}: ${log.oldValue ?? "—"} → ${log.newValue ?? "—"}` : "—")}
                  </td>
                  <td className="px-3 py-2.5 pr-0 align-middle text-xs text-muted-foreground">
                    {log.ipAddress || "—"}
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Önceki
        </Button>
        <span className="text-xs text-muted-foreground">Sayfa {page}</span>
        <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
          Sonraki <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
