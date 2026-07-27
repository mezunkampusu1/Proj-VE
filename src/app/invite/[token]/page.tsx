import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcceptInviteButton } from "@/components/teams/accept-invite-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: { select: { name: true } } },
  });

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <h1 className="text-lg font-semibold text-foreground">Davet geçersiz</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bu davet bağlantısı geçersiz veya süresi dolmuş.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-lg font-semibold text-foreground">Ekip Daveti</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">{invite.team.name}</strong> ekibine katılmaya davet
          edildiniz.
        </p>
        <div className="mt-4">
          <AcceptInviteButton token={token} teamId={invite.teamId} />
        </div>
      </div>
    </div>
  );
}
