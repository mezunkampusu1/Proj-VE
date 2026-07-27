import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { AdminDashboard } from "@/components/ortak-alan/admin-dashboard";

export default async function OrtakAlanAdminPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  if (membership?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ortak Alan Yönetimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Doküman istatistikleri, doküman türleri ve şablon yönetimi.
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
