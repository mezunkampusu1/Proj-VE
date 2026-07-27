import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { FileManager } from "@/components/files/file-manager";

export default async function FilesPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  const teamMembers = await prisma.teamMember.findMany({
    where: { teamId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const members = teamMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dosyalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ekip genelinde paylaşılan dosyaları yükleyin ve yönetin.
        </p>
      </div>
      <FileManager
        currentUserId={session!.user.id}
        isAdmin={membership?.role === "ADMIN"}
        members={members}
      />
    </div>
  );
}
