import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { DocumentSearchView } from "@/components/ortak-alan/document-search-view";

export default async function DocumentSearchPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  await requireTeamMember(workspace.id, session!.user.id);

  return <DocumentSearchView />;
}
