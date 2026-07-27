"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Activity, Users2, Globe, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activityActionLabel, moduleNameLabel } from "@/lib/utils";
import { toast } from "sonner";

interface LogRow {
  id: string;
  action: string;
  message: string;
  module: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
}

interface SummaryResponse {
  totalToday: number;
  activeUsersToday: number;
  uniqueIpsToday: number;
  byModuleToday: { module: string; count: number }[];
}

interface TeamMemberOption {
  user: { id: string; name: string | null; email: string | null };
}

const MODULE_OPTIONS = [
  "TASKS",
  "ANNOUNCEMENTS",
  "DATES",
  "ATLAS",
  "FILES",
  "USER_REPORTS",
  "TEAM",
  "UNIVERSITIES",
  "DAILY_FLOW",
  "DOCUMENTS",
];

const ACTION_OPTIONS = [
  "PROJECT_CREATED",
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_STATUS_CHANGED",
  "TASK_ASSIGNED",
  "TASK_DELETED",
  "COMMENT_ADDED",
  "TASK_COLUMN_CREATED",
  "TASK_COLUMN_UPDATED",
  "TASK_COLUMN_DELETED",
  "RECURRING_TASK_CREATED",
  "RECURRING_TASK_UPDATED",
  "RECURRING_TASK_DELETED",
  "MEMBER_JOINED",
  "MEMBER_ROLE_CHANGED",
  "DAILY_STAT_RECORDED",
  "ANNOUNCEMENT_CREATED",
  "ANNOUNCEMENT_UPDATED",
  "ANNOUNCEMENT_DELETED",
  "ANNOUNCEMENT_TYPE_CREATED",
  "DATE_CREATED",
  "DATE_UPDATED",
  "DATE_DELETED",
  "DATE_TYPE_CREATED",
  "ATLAS_PROGRAM_CREATED",
  "ATLAS_PROGRAM_UPDATED",
  "ATLAS_PROGRAM_REMOVED",
  "INSTITUTE_CREATED",
  "INSTITUTE_UPDATED",
  "INSTITUTE_DELETED",
  "INSTITUTE_IMPORTED",
  "FILE_UPLOADED",
  "FILE_DELETED",
  "ATTACHMENT_ADDED",
  "ATTACHMENT_REMOVED",
  "UNIVERSITY_CREATED",
  "UNIVERSITY_UPDATED",
  "UNIVERSITY_IMPORTED",
  "DAILY_FLOW_STARTED",
  "DAILY_FLOW_BREAK_STARTED",
  "DAILY_FLOW_BREAK_ENDED",
  "DAILY_FLOW_COMPLETED",
  "DAILY_FLOW_EDITED",
  "DAILY_FLOW_REOPENED",
  "DAILY_FLOW_SETTING_UPDATED",
  "DOCUMENT_CREATED",
  "DOCUMENT_UPDATED",
  "DOCUMENT_DELETED",
  "DOCUMENT_RESTORED",
  "DOCUMENT_SHARED",
  "DOCUMENT_STATUS_CHANGED",
  "DOCUMENT_APPROVED",
  "DOCUMENT_FOLDER_CREATED",
];

const MODULE_TONE: Record<string, "slate" | "blue" | "amber" | "green" | "red"> = {
  TASKS: "blue",
  ANNOUNCEMENTS: "red",
  DATES: "amber",
  ATLAS: "green",
  FILES: "slate",
  USER_REPORTS: "blue",
  TEAM: "red",
  UNIVERSITIES: "green",
  DAILY_FLOW: "amber",
  DOCUMENTS: "slate",
};

/**
 * Sistem genelindeki aktivite günlüğü — "log rapor canavarı" (bkz.
 * kullanıcı isteği: "her adımlarını görebildiğim aşırı temiz birşey
 * istiyorum... ip adresileri v.s."). Yalnızca yöneticiler erişebilir
 * (bkz. sayfa/route seviyesindeki kontroller). Üstte bugünün özet
 * kartları, altta filtrelenebilir/sayfalanabilir tam kayıt listesi.
 */
export function ActivityLogView({ teamId }: { teamId: string }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("all");
  const [action, setAction] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
    if (userId !== "all") params.set("userId", userId);
    if (action !== "all") params.set("action", action);
    if (moduleFilter !== "all") params.set("module", moduleFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());

    fetch(`/api/activity-log?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setLogs(json.logs ?? []);
        setTotal(json.total ?? 0);
        setHasMore(!!json.hasMore);
        setSummary(json.summary ?? null);
      })
      .catch(() => toast.error("Aktivite günlüğü yüklenemedi."))
      .finally(() => setLoading(false));
  }, [page, userId, action, moduleFilter, from, to, q]);

  useEffect(() => setPage(1), [userId, action, moduleFilter, from, to, q]);

  const topModuleToday = summary?.byModuleToday[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Bugünkü Etkinlik" value={summary?.totalToday ?? 0} tone="blue" />
        <StatCard icon={Users2} label="Bugün Aktif Kullanıcı" value={summary?.activeUsersToday ?? 0} tone="green" />
        <StatCard icon={Globe} label="Bugün Farklı IP" value={summary?.uniqueIpsToday ?? 0} tone="amber" />
        <StatCard
          icon={Flame}
          label="En Yoğun Modül (Bugün)"
          value={topModuleToday ? moduleNameLabel(topModuleToday.module) : "—"}
          tone="red"
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mesajda ara…"
            className="max-w-xs"
          />
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-44">
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
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Modül" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm modüller</SelectItem>
              {MODULE_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {moduleNameLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Eylem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm eylemler</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {activityActionLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{total} kayıt</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-5">
          {/* Revizyon: "yazılar yan yana geliyor" — hücrelerde yalnızca
              dikey boşluk (py) vardı, yatay boşluk (px) yoktu; bu yüzden
              bitişik sütunlardaki metinler (örn. Eylem/Ayrıntı) araya
              hiç boşluk girmeden birleşiyordu. Her <th>/<td>'ye yatay
              boşluk + dikey ortalama eklendi, sütun genişlikleri <col>
              ile sabitlendi ki içerik uzunluğuna göre daralıp genişlik
              kaymasın. */}
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[140px]" />
              <col className="w-[170px]" />
              <col />
              <col className="w-[130px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 pl-0 font-medium">Zaman</th>
                <th className="px-3 py-2 font-medium">Kullanıcı</th>
                <th className="px-3 py-2 font-medium">Modül</th>
                <th className="px-3 py-2 font-medium">Eylem</th>
                <th className="px-3 py-2 font-medium">Ayrıntı</th>
                <th className="px-3 py-2 pr-0 font-medium">IP Adresi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 pl-0 align-middle text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={log.user.name} email={log.user.email} size={22} />
                      <span className="truncate text-foreground">{log.user.name || log.user.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <Badge tone={MODULE_TONE[log.module ?? ""] ?? "slate"}>{moduleNameLabel(log.module)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 align-middle text-xs text-muted-foreground">
                    {activityActionLabel(log.action)}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-foreground/90">
                    <span className="break-words">{log.message}</span>
                    {log.project && (
                      <>
                        {" "}
                        <Link
                          href={`/teams/${teamId}/projects/${log.project.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          ({log.project.name})
                        </Link>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 pr-0 align-middle text-xs text-muted-foreground">
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: "blue" | "red" | "green" | "amber";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint-${tone} text-tint-${tone}-foreground`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-2xl font-semibold text-foreground">{value}</p>
        </span>
      </CardContent>
    </Card>
  );
}
