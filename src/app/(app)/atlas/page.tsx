import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { AtlasView } from "@/components/atlas/atlas-view";

export default async function AtlasPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  // Kişi etiketleme (bkz. kullanıcı talebi #3) için ekip üyesi listesi.
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
        <h1 className="text-xl font-semibold text-foreground">Atlas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Üniversite &gt; Enstitü &gt; Program hiyerarşisini ve değişiklik geçmişini yönetin.
        </p>
      </div>
      <AtlasView
        currentUserId={session!.user.id}
        isAdmin={membership?.role === "ADMIN"}
        members={members}
      />
    </div>
  );
}
