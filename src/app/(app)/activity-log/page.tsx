import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { ActivityLogView } from "@/components/activity-log/activity-log-view";

/**
 * Sistem geneli aktivite günlüğü sayfası (bkz. revizyon: "Son Aktiviteler
 * kısmı sadece adminde görülsün... log sayfasında çalışanlar bunu
 * görmesin"). Hem nav'da (app-shell.tsx) hem burada çift kilitli: yalnızca
 * takım yöneticileri erişebilir.
 */
export default async function ActivityLogPage() {
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
        <h1 className="text-xl font-semibold text-foreground">Aktivite Günlüğü</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sistemdeki tüm işlemlerin tam, filtrelenebilir kaydı — kim, ne yaptı, ne zaman, hangi modülde, hangi IP&apos;den.
        </p>
      </div>
      <ActivityLogView teamId={workspace.id} />
    </div>
  );
}
