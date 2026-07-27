import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { resolveFinancePermissions } from "@/lib/finance-permissions";
import { generateDueFinanceTransactions, notifyDuePayments } from "@/lib/finance";
import { FinanceView } from "@/components/finance/finance-view";

export default async function FinancePage() {
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await getTeamMembership(workspace.id, userId);
  const permissions = await resolveFinancePermissions(userId, membership?.role ?? "MEMBER");

  // Sayfa her açıldığında tekrarlayan giderleri üret ve yaklaşan/geciken
  // ödeme bildirimlerini gönder — cron gerektirmez (bkz. proje talebi §9,
  // ensureRecurringTasksForDate ile aynı desen).
  await generateDueFinanceTransactions();
  await notifyDuePayments();

  if (!permissions.canViewFinance) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Finans sayfasını görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Finans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Şirket içi günlük gelir ve giderleri takip edin — sade ve hızlı.
        </p>
      </div>
      <FinanceView currentUserId={userId} members={members.map((m) => m.user)} isAdmin={membership?.role === "ADMIN"} />
    </div>
  );
}
