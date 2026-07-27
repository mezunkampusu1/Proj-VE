"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Calendar, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  kind: "DATED" | "FIXED";
  creatorId: string | null;
  _count: { tasks: number };
}

export function ProjectsGrid({
  teamId,
  projects,
  currentUserId,
  isAdmin,
}: {
  teamId: string;
  projects: ProjectItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Kullanıcı talebi: "proje oluşturduğumda karşı taraf f5 çekmeden
  // göremiyor, onlarda anlık görebilsin" — bu bileşen yalnızca sayfa ilk
  // yüklenirken sunucudan gelen `projects` prop'unu gösteriyordu, başka bir
  // üyenin oluşturduğu proje sekme yenilenene kadar listeye düşmüyordu.
  // Diğer modüllerdeki (kanban-board.tsx, team-status-list.tsx vb.) AYNI
  // "yeterince anlık" yoklama desenine uyacak şekilde 5 saniyelik periyodik
  // yoklama + sekme tekrar görünür/odakta olduğunda anında yenileme eklendi.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/teams/${teamId}/projects`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setItems(data.projects);
    }
    const interval = setInterval(load, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [teamId]);

  async function deleteProject(projectId: string) {
    setDeleting(true);
    setItems((prev) => prev.filter((p) => p.id !== projectId));
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDeleteId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Henüz proje yok. Başlamak için &ldquo;Yeni Proje&rdquo; oluşturun.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((project) => {
        // Kullanıcı talebi: "kişi sadece göreve etiketliyse projeyi
        // silemesin, sadece proje sahibi + admin silebilsin" — sunucu bunu
        // zaten zorunlu kılıyor (bkz. DELETE /api/projects/[projectId]),
        // burada da yalnızca yetkisi olanlara silme ikonu gösterilir; aksi
        // halde tıklayan bir üye anlamsız bir hata mesajıyla karşılaşırdı.
        const canDelete = isAdmin || project.creatorId === currentUserId;
        return (
        <Card key={project.id} className="group relative transition-colors hover:border-primary/50">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmDeleteId(project.id);
              }}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label={`${project.name} projesini sil`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <Link href={`/teams/${teamId}/projects/${project.id}`}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-2 pr-6">
                <h2 className="font-semibold text-foreground">{project.name}</h2>
                {project.status === "ARCHIVED" && <Badge tone="slate">Arşivlendi</Badge>}
              </div>
              {project.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {project.kind === "FIXED" ? (
                    <Pin className="h-3 w-3" />
                  ) : (
                    <Calendar className="h-3 w-3" />
                  )}
                  {project.kind === "FIXED" ? "Sabit" : "Günlük Plan"}
                </span>
                <span>·</span>
                <span>{project._count.tasks} görev</span>
              </div>
            </CardContent>
          </Link>
        </Card>
        );
      })}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && !deleting && setConfirmDeleteId(null)}
        description="Bu projeyi ve içindeki tüm görevleri, sütunları, notları ve dosyaları silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => confirmDeleteId && deleteProject(confirmDeleteId)}
      />
    </div>
  );
}
