import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamMembership, projectVisibilityWhere } from "@/lib/permissions";
import { CreateProjectButton } from "@/components/projects/create-project-form";
import { ProjectsGrid } from "@/components/projects/projects-grid";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const membership = await getTeamMembership(teamId, userId);
  if (!membership) notFound();

  // Kullanıcı talebi #6 (netleştirilmiş): bu sayfa projeleri DOĞRUDAN
  // prisma ile çekiyor, GET /api/teams/[teamId]/projects'i hiç çağırmıyor
  // — bu yüzden o route'a eklenen görünürlük filtresi burada uygulanmıyordu
  // ("kartı listede görüyorum ama açınca yetkiniz yok" hatası). Artık AYNI
  // tek kaynaklı `projectVisibilityWhere` kullanılıyor (bkz. lib/permissions.ts).
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      projects: {
        where: projectVisibilityWhere(membership.role, userId),
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!team) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projelendirme</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/teams/${team.id}/members`} className="hover:underline">
              Ekibi yönet
            </Link>
          </p>
        </div>
        <CreateProjectButton teamId={team.id} />
      </div>

      <ProjectsGrid
        teamId={team.id}
        projects={team.projects}
        currentUserId={userId}
        isAdmin={membership.role === "ADMIN"}
      />
    </div>
  );
}
