import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { FinanceDetailView } from "@/components/finance/finance-detail-view";

interface Params {
  params: Promise<{ transactionId: string }>;
}

export default async function FinanceTransactionPage({ params }: Params) {
  const { transactionId } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getOrCreateWorkspaceTeam(userId);

  const members = await prisma.teamMember.findMany({
    where: { teamId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <FinanceDetailView transactionId={transactionId} currentUserId={userId} members={members.map((m) => m.user)} />
    </div>
  );
}
