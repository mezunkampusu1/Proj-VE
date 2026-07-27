"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token, teamId }: { token: string; teamId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Davet kabul edilemedi.");
      return;
    }

    router.push(`/teams/${teamId}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={accept} disabled={loading} className="w-full">
        {loading ? "Katılıyor..." : "Daveti Kabul Et"}
      </Button>
    </div>
  );
}
