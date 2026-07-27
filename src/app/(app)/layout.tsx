import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await getOrCreateWorkspaceTeam(session.user.id);
  const membership = await getTeamMembership(workspace.id, session.user.id);

  return (
    <AppShell
      user={session.user}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      role={membership?.role ?? "MEMBER"}
    >
      {children}
    </AppShell>
  );
}
