"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn, dailyFlowStatusLabel } from "@/lib/utils";
import { onDailyFlowChanged } from "@/lib/daily-flow-events";

type FlowStatus = "NOT_STARTED" | "ACTIVE" | "ON_BREAK" | "COMPLETED";

interface TeamMemberStatus {
  user: { id: string; name: string | null; email: string; image: string | null };
  status: FlowStatus;
}

const statusTone: Record<FlowStatus, "slate" | "blue" | "amber" | "green"> = {
  NOT_STARTED: "slate",
  ACTIVE: "blue",
  ON_BREAK: "amber",
  COMPLETED: "green",
};

const statusDot: Record<FlowStatus, string> = {
  NOT_STARTED: "bg-muted-foreground/40",
  ACTIVE: "bg-tint-blue-foreground",
  ON_BREAK: "bg-tint-amber-foreground",
  COMPLETED: "bg-tint-green-foreground",
};

/**
 * Ekip görünümü — yalnızca anlık durum, süre/detay göstermez (bkz. proje
 * kuralı §6). Denetim hissi vermeyen sade bir liste amaçlanır. Revizyon:
 * "Ekip durumu çok şık bir şekilde görsünler" — üstte canlı bir özet
 * (kaç kişi aktif/arada), her satırda avatarın üstünde durumu anında
 * gösteren küçük bir renkli nokta eklendi.
 */
export function TeamStatusList({ isAdmin }: { isAdmin: boolean }) {
  const [team, setTeam] = useState<TeamMemberStatus[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/daily-flow/team");
      if (!res.ok) return;
      const data = await res.json();
      setTeam(data.team);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Kullanıcı talebi: "kişi ara verdiğinde/akışa döndüğünde F5 atmam
    // gerekiyor, biraz geç geliyor" — bu, `emitDailyFlowChanged()` (bkz.
    // daily-flow-events.ts) tarafından çözülen senaryodan (KENDİ
    // aksiyonunuz kendi ekranınıza anında yansısın) FARKLI: burada BAŞKA
    // bir ekip üyesinin durumu değiştiğinde SİZİN ekranınızın ne kadar
    // sürede haberdar olduğu şikayet ediliyor — bu yalnızca periyodik
    // yoklamayla mümkün ve önceki 30 saniyelik aralık gözle görülür bir
    // gecikme yaratıyordu. Diğer modüllerde zaten kurulu "yeterince anlık"
    // yoklama deseniyle (bkz. kanban-board.tsx, spreadsheet-editor.tsx)
    // tutarlı olacak şekilde 5 saniyeye düşürüldü, ayrıca sekme tekrar
    // görünür/odakta olduğunda (§ "akışa döndüğünde") döngüyü beklemeden
    // anında bir yenileme tetiklenir.
    const interval = setInterval(load, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    // Kendi DailyFlowCard'ınızdan bir aksiyon (başlat/ara ver/dön/tamamla)
    // yapıldığında bu listeyi döngüyü beklemeden hemen tazeler (bkz.
    // daily-flow-events.ts).
    const unsubscribe = onDailyFlowChanged(load);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
      unsubscribe();
    };
  }, []);

  const activeCount = team?.filter((m) => m.status === "ACTIVE").length ?? 0;
  const onBreakCount = team?.filter((m) => m.status === "ON_BREAK").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {team && team.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{team.length}</span> kişiden{" "}
            <span className="font-medium text-tint-blue-foreground">{activeCount}</span> aktif
            {onBreakCount > 0 && (
              <>
                {" "}
                · <span className="font-medium text-tint-amber-foreground">{onBreakCount}</span> arada
              </>
            )}
          </p>
        ) : (
          <span />
        )}
        {isAdmin && (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/daily-flow/admin" className="gap-2">
              <Settings className="h-4 w-4" /> Günlük Akış Yönetimi
            </Link>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 bg-[image:var(--gradient-primary)]" />
        <CardContent className="divide-y divide-border pt-5">
          {team === null && <p className="py-4 text-sm text-muted-foreground">Yükleniyor...</p>}
          {team?.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Ekipte henüz üye yok.</p>
          )}
          {team?.map((m) => (
            <div
              key={m.user.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar name={m.user.name} email={m.user.email} size={32} />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                      statusDot[m.status],
                    )}
                  />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {m.user.name || m.user.email}
                </span>
              </div>
              <Badge tone={statusTone[m.status]}>{dailyFlowStatusLabel(m.status)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
