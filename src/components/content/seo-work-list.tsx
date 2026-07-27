"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { contentStatusLabel, contentStatusTone, formatDate, seoWorkTypeLabel } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";

interface SeoWorkRow {
  id: string;
  workType: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  brand: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null; email: string; image: string | null };
  assignedTo: { id: string; name: string | null; email: string; image: string | null } | null;
}

export function SeoWorkList({
  filters,
  refreshKey,
  onEdit,
}: {
  filters: { search: string; status: string; personId: string };
  refreshKey: number;
  onEdit: (id: string) => void;
}) {
  const [rows, setRows] = useState<SeoWorkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.personId, refreshKey]);

  function load() {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.personId) params.set("personId", filters.personId);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/content/seo?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, refreshKey]);

  // Kullanıcı talebi: liste F5 atmadan gelsin.
  useLiveRefresh(load, 10000);

  if (loading && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Yükleniyor...</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card
          key={row.id}
          className="cursor-pointer transition-colors hover:border-primary/40"
          onClick={() => onEdit(row.id)}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={contentStatusTone[row.status] ?? "slate"}>{contentStatusLabel(row.status)}</Badge>
                <Badge tone="slate">{seoWorkTypeLabel(row.workType)}</Badge>
                {row.priority === "URGENT" && <Badge tone="red">Acil</Badge>}
              </div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{row.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.brand ? `${row.brand.name} · ` : ""}
                {row.createdBy.name || row.createdBy.email}
                {row.dueDate ? ` · Termin: ${formatDate(row.dueDate)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {row.assignedTo && <Avatar name={row.assignedTo.name} email={row.assignedTo.email} image={row.assignedTo.image} size={24} />}
              <Button variant="secondary" size="sm" onClick={() => onEdit(row.id)}>
                <Eye className="mr-1 h-3.5 w-3.5" />
                Görüntüle
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {total > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <Button variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
