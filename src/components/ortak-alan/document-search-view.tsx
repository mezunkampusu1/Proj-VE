"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { documentStatusLabel, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface DocumentType {
  id: string;
  name: string;
}

interface SearchResult {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  contentText: string | null;
  type: DocumentType | null;
  folder: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string | null };
}

const STATUS_OPTIONS = [
  "DRAFT",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BEING_REVISED",
  "PENDING_APPROVAL",
  "APPROVED",
  "READY_TO_PUBLISH",
  "COMPLETED",
  "ARCHIVED",
];

function snippet(text: string | null, max = 160): string {
  if (!text) return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * Ortak Alan arama ekranı (§ arama ve filtreleme). Ana ekran (klasör ağacı
 * + doküman listesi) henüz ayrı bir görevde inşa edilecek; bu ekran o
 * zamana kadar aramaya bağımsız bir giriş noktası sağlar ve AppShell
 * gezinmesine (nav görevinde) buradan bağlanacak.
 */
export function DocumentSearchView() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeId, setTypeId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/document-types")
      .then((r) => r.json())
      .then((json) => setTypes(json.types ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const hasFilters = debouncedQuery.trim() || typeId !== "all" || status !== "all";
    if (!hasFilters) {
      setResults([]);
      setSearched(false);
      return;
    }
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (typeId !== "all") params.set("typeId", typeId);
    if (status !== "all") params.set("status", status);

    setLoading(true);
    fetch(`/api/documents/search?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setResults(json.documents ?? []);
        setSearched(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, typeId, status]);

  const clearFilters = () => {
    setQuery("");
    setTypeId("all");
    setStatus("all");
  };

  const hasActiveFilters = query || typeId !== "all" || status !== "all";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Doküman Arama</h1>
        <p className="text-sm text-muted-foreground">Başlık ve içerik üzerinde tam metin arama yapın.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Doküman ara…"
            className="pl-9"
            autoFocus
          />
        </div>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tür" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm türler</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {documentStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Filtreleri temizle">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aranıyor…</p>
        ) : !searched ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aramaya başlamak için bir anahtar kelime yazın veya filtre seçin.
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p>
        ) : (
          <div className="space-y-2">
            {results.map((doc) => (
              <Link
                key={doc.id}
                href={`/ortak-alan/${doc.id}`}
                className="block rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{doc.title || "Adsız doküman"}</p>
                      {doc.contentText && <p className="mt-0.5 text-xs text-muted-foreground">{snippet(doc.contentText)}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {doc.type && <span className="rounded-full bg-secondary px-2 py-0.5">{doc.type.name}</span>}
                        {doc.folder && <span>{doc.folder.name}</span>}
                        <span>{doc.owner.name || doc.owner.email}</span>
                        <span>{formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: tr })}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground")}>
                    {documentStatusLabel(doc.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
