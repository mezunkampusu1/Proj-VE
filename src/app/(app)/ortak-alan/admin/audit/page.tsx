import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { AuditLogView } from "@/components/ortak-alan/audit-log-view";

export default async function OrtakAlanAuditPage() {
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
        <h1 className="text-xl font-semibold text-foreground">Denetim Kayıtları</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ortak Alan&apos;daki tüm hassas eylemlerin tam kaydı — yalnızca yöneticiler görebilir.
        </p>
      </div>
      <AuditLogView teamId={workspace.id} />
    </div>
  );
}
