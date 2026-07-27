import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamMembership } from "@/lib/permissions";
import { MemberManagement } from "@/components/teams/member-management";

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const membership = await getTeamMembership(teamId, userId);
  if (!membership) notFound();

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) notFound();

  const [members, invites] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.teamInvite.findMany({
      where: { teamId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ekip</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ekip üyelerini ve rollerini yönetin.</p>
      </div>
      <MemberManagement
        teamId={teamId}
        members={members}
        invites={invites}
        isAdmin={membership.role === "ADMIN"}
      />
    </div>
  );
}
