import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { resolveContentPermissions } from "@/lib/content-permissions";
import { ContentReportsView } from "@/components/content/content-reports-view";

export default async function ContentReportsPage() {
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await getTeamMembership(workspace.id, userId);
  const permissions = await resolveContentPermissions(userId, membership?.role ?? "MEMBER");

  if (!permissions.canViewModule || !permissions.canViewReports) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Raporları görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Raporlama &amp; Performans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İçerik üretimi, yayınlanan içerik performansı ve ekip üretkenliğine dair özet raporlar.
        </p>
      </div>
      <ContentReportsView />
    </div>
  );
}
