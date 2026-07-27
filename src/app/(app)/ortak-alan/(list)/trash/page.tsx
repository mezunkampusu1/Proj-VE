import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { DocumentListView } from "@/components/ortak-alan/document-list-view";

export default async function TrashPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await requireTeamMember(workspace.id, session!.user.id);

  return <DocumentListView mode="trash" isAdmin={membership.role === "ADMIN"} />;
}
