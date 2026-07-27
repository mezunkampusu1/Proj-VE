"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function AiSummaryButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setSummary(null);

    const res = await fetch("/api/ai/summarize-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Özet oluşturulamadı.");
      return;
    }

    const data = await res.json();
    setSummary(data.summary);
  }

  return (
    <>
      <Button variant="secondary" onClick={generate}>
        AI Özet
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Proje Durum Özeti (AI)">
        {loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">Özet hazırlanıyor...</p>
        )}
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        {summary && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{summary}</p>
        )}
      </Modal>
    </>
  );
}
