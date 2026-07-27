import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { UserReportsView } from "@/components/reports/user-reports-view";

export default async function ReportsPage() {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await getTeamMembership(workspace.id, session!.user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Kullanıcı Raporları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Günlük yeni kullanıcı, e-posta ve telefon doğrulama sayılarını girin, trendi takip edin.
        </p>
      </div>
      <UserReportsView
        currentUserId={session!.user.id}
        isAdmin={membership?.role === "ADMIN"}
      />
    </div>
  );
}
