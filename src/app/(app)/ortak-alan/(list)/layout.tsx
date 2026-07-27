import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { OrtakAlanSidebar } from "@/components/ortak-alan/ortak-alan-sidebar";

/**
 * `(list)` rota grubu — Ana ekran, Ara, Favoriler, Arşiv, Çöp Kutusu bu
 * grubun altında yaşar ve hepsi bu ortak kenar çubuğunu paylaşır (bkz.
 * görev #187: bu sayfalara geçildiğinde kenar çubuğunun tamamen
 * kaybolması bildirildi). Tek bir doküman açıldığında ([documentId]) veya
 * yönetim ekranlarında (admin) bu kenar çubuğu YOK — onlar bu grubun
 * dışında, kendi tam genişlikli düzenlerini kullanmaya devam ediyor.
 */
export default async function OrtakAlanListLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await requireTeamMember(workspace.id, session!.user.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <Suspense>
        <OrtakAlanSidebar isAdmin={membership.role === "ADMIN"} teamId={workspace.id} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
