import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { resolveContentPermissions } from "@/lib/content-permissions";
import { SocialContentView } from "@/components/content/social-content-view";

export default async function SocialContentPage() {
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await getTeamMembership(workspace.id, userId);
  const permissions = await resolveContentPermissions(userId, membership?.role ?? "MEMBER");

  if (!permissions.canViewModule) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Bu modülü görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  const [members, brands] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.contentBrand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sosyal Medya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instagram, LinkedIn, X, TikTok ve Facebook içeriklerini planlayın ve takip edin.
        </p>
      </div>
      <SocialContentView
        currentUserId={userId}
        members={members.map((m) => m.user)}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        permissions={permissions}
        isAdmin={membership?.role === "ADMIN"}
      />
    </div>
  );
}
