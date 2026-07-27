"use client";

import { useEffect, useState } from "react";
import { Lock, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentToHtml, type PMNode } from "@/lib/document-export";
import { documentStatusLabel } from "@/lib/utils";

interface SharedDoc {
  title: string;
  content: PMNode;
  status: string;
  updatedAt: string;
  owner: { name: string | null; email: string | null };
}

type State =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "password"; title: string }
  | { phase: "ready"; doc: SharedDoc };

/** Bu bileşenin çevresinde bir AppShell YOKTUR — dış kullanıcılar için sade, bağımsız bir görünüm. */
export function PublicShareView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/documents/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          setState({ phase: "invalid" });
          return;
        }
        const json = await r.json();
        if (json.requiresPassword) {
          setState({ phase: "password", title: json.title });
        } else {
          setState({ phase: "ready", doc: json });
        }
      })
      .catch(() => setState({ phase: "invalid" }));
  }, [token]);

  const submitPassword = async () => {
    setSubmitting(true);
    setPasswordError(null);
    try {
      const res = await fetch(`/api/public/documents/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPasswordError(json.error || "Şifre doğrulanamadı.");
        return;
      }
      setState({ phase: "ready", doc: json });
    } catch {
      setPasswordError("Bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state.phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.phase === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Bağlantı geçersiz veya süresi dolmuş</h1>
        <p className="text-sm text-muted-foreground">Bu paylaşım bağlantısı artık kullanılamıyor.</p>
      </div>
    );
  }

  if (state.phase === "password") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">{state.title}</h1>
          <p className="text-sm text-muted-foreground">Bu doküman şifre ile korunuyor.</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            placeholder="Şifre"
          />
          {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          <Button onClick={submitPassword} disabled={submitting || !password}>
            Görüntüle
          </Button>
        </div>
      </div>
    );
  }

  const { doc } = state;
  const html = documentToHtml(doc.content || { type: "doc", content: [] });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">{doc.title || "Adsız doküman"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {doc.owner.name || doc.owner.email} · {documentStatusLabel(doc.status)} ·{" "}
          {new Date(doc.updatedAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu, salt okunur, ekip dışı bir paylaşım görünümüdür.
        </p>
      </header>
      <article
        className="max-w-none text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
