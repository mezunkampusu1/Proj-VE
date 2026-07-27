import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { MainView } from "@/components/ortak-alan/main-view";

export default async function OrtakAlanPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await requireTeamMember(workspace.id, session!.user.id);

  return (
    <Suspense>
      <MainView isAdmin={membership.role === "ADMIN"} teamId={workspace.id} currentUserId={session!.user.id} />
    </Suspense>
  );
}
