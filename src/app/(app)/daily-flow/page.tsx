import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { TeamStatusList } from "@/components/daily-flow/team-status-list";

export default async function DailyFlowPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Günlük Akış — Ekip Durumu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ekip arkadaşlarının şu anki çalışma durumu.
        </p>
      </div>
      <TeamStatusList isAdmin={membership?.role === "ADMIN"} />
    </div>
  );
}
