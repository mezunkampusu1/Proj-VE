import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { resolveContentPermissions } from "@/lib/content-permissions";
import { ContentCalendar } from "@/components/content/content-calendar";

export default async function ContentCalendarPage() {
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await getTeamMembership(workspace.id, userId);
  const permissions = await resolveContentPermissions(userId, membership?.role ?? "MEMBER");

  if (!permissions.canViewModule) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Bu modülü görüntüleme yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">İçerik Takvimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planlanan sosyal medya/blog yayınları ve SEO/site içi son tarihleri — sürükleyip bırakarak yayın tarihini değiştirebilirsiniz.
        </p>
      </div>
      <ContentCalendar canEdit={permissions.canScheduleContent || permissions.canEditAllContent} />
    </div>
  );
}
