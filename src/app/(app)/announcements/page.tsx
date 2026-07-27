import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { AnnouncementsView } from "@/components/announcements/announcements-view";

export default async function AnnouncementsPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  // Kişi etiketleme (bkz. görev #172) için ekip üyesi listesi.
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Duyurular</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Üniversitelerden gelen sempozyum, kongre ve öğrenci alımı duyurularını takip edin.
        </p>
      </div>
      <AnnouncementsView
        currentUserId={session!.user.id}
        isAdmin={membership?.role === "ADMIN"}
        members={members}
      />
    </div>
  );
}
