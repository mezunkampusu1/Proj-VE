import Link from "next/link";
import {
  ListChecks,
  AlertTriangle,
  PartyPopper,
  KanbanSquare,
  Layers,
  Users2,
  Megaphone,
  CalendarRange,
  FolderOpen,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, priorityTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyFlowCard } from "@/components/daily-flow/daily-flow-card";
import { TeamStatusList } from "@/components/daily-flow/team-status-list";
import { ContentDashboardSection } from "@/components/content/content-dashboard-section";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { getTeamMembership } from "@/lib/permissions";
import { resolveContentPermissions } from "@/lib/content-permissions";
import { formatDate, priorityLabel, cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Ana Panel'de kimin aktif/arada olduğunu herkes görebilsin diye
  // TeamStatusList burada da gösterilir — Günlük Akış sayfasına gitmeye
  // gerek kalmadan (bkz. görev #170).
  const workspace = await getOrCreateWorkspaceTeam(userId);
  const membership = await getTeamMembership(workspace.id, userId);
  const isAdmin = membership?.role === "ADMIN";
  const contentPermissions = await resolveContentPermissions(userId, membership?.role ?? "MEMBER");

  const monthStart = new Date(new Date().setDate(1));
  monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    myTasks,
    openCount,
    overdueCount,
    doneTodayCount,
    recentActivity,
    documentsCount,
    upcomingDatesCount,
    announcementsThisMonth,
    filesCount,
    newUsersThisMonth,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { assignees: { some: { userId } }, column: { isDoneColumn: false } },
      include: {
        project: { select: { id: true, name: true, teamId: true } },
        column: { select: { id: true, name: true, isDoneColumn: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 8,
    }),
    prisma.task.count({ where: { assignees: { some: { userId } }, column: { isDoneColumn: false } } }),
    prisma.task.count({
      where: {
        assignees: { some: { userId } },
        column: { isDoneColumn: false },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.task.count({
      where: {
        assignees: { some: { userId } },
        column: { isDoneColumn: true },
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    // Revizyon: "Son Aktiviteler kısmı sadece adminde görülsün" — sorgu
    // yalnızca yönetici için gerçekten anlamlı olsa da burada her zaman
    // çekiliyor (küçük/sınırlı bir sorgu), gösterimi aşağıda role göre
    // kısıtlanıyor; tam liste artık /activity-log sayfasında.
    isAdmin
      ? prisma.activityLog.findMany({
          where: { teamId: workspace.id },
          include: { user: { select: { name: true, email: true } }, team: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.importantDate.count({ where: { date: { gte: todayStart } } }),
    prisma.announcement.count({ where: { entryDate: { gte: monthStart } } }),
    prisma.fileUpload.count(),
    prisma.dailyUserStat.aggregate({ _sum: { newUserCount: true }, where: { date: { gte: monthStart } } }),
  ]);

  const moduleStats: {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    tone: "blue" | "red" | "green" | "slate" | "amber";
    href: string;
  }[] = [
    { label: "Açık Görevleriniz", value: openCount, icon: KanbanSquare, tone: "blue", href: `/teams/${workspace.id}` },
    { label: "Ortak Alan'daki Dokümanlar", value: documentsCount, icon: Layers, tone: "slate", href: "/ortak-alan" },
    {
      label: "Bu Ay Yeni Kullanıcı",
      value: newUsersThisMonth._sum.newUserCount ?? 0,
      icon: Users2,
      tone: "green",
      href: "/reports",
    },
    { label: "Bu Ay Duyuru", value: announcementsThisMonth, icon: Megaphone, tone: "amber", href: "/announcements" },
    { label: "Yaklaşan Tarihler", value: upcomingDatesCount, icon: CalendarRange, tone: "red", href: "/dates" },
    { label: "Toplam Dosya", value: filesCount, icon: FolderOpen, tone: "blue", href: "/files" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Merhaba, {session!.user.name?.split(" ")[0] || "hoş geldiniz"} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">İşte bugüne genel bakış.</p>
      </div>

      <DailyFlowCard />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Ekip Durumu</h2>
        <TeamStatusList isAdmin={membership?.role === "ADMIN"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Açık Görevleriniz" value={openCount} icon={ListChecks} tone="blue" />
        <StatCard
          label="Geciken Görevler"
          value={overdueCount}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? "red" : "slate"}
        />
        <StatCard label="Bugün Tamamlanan" value={doneTodayCount} icon={PartyPopper} tone="green" />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Modülleriniz</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleStats.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} icon={m.icon} tone={m.tone} href={m.href} />
          ))}
        </div>
      </div>

      {/* Eskiden ayrı bir "Genel Bakış" sayfasıydı (/content) — ana Panel'e
          taşındı (bkz. content-dashboard-section.tsx). Modülü göremeyen
          kullanıcıya hiç gösterilmez. */}
      {contentPermissions.canViewModule && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Sosyal Medya &amp; İçerik</h2>
          <ContentDashboardSection />
        </div>
      )}

      <div className={cn("grid gap-6", isAdmin ? "md:grid-cols-2" : "grid-cols-1")}>
        <Card>
          <CardHeader>
            <CardTitle>Size Atanan Görevler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">Şu anda üzerinize atanmış açık görev yok.</p>
            )}
            {myTasks.map((task) => (
              <Link
                key={task.id}
                href={`/teams/${task.project.teamId}/projects/${task.project.id}`}
                className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <Badge tone={priorityTone(task.priority)}>{priorityLabel(task.priority)}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{task.project.name}</span>
                  <Badge tone="slate">{task.column.name}</Badge>
                  {task.dueDate && <span>Son tarih: {formatDate(task.dueDate)}</span>}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Revizyon: "Son Aktiviteler kısmı sadece adminde görülsün ama log
            sayfasında çalışanlar bunu görmesin" — tam liste artık yalnızca
            yöneticilerin görebildiği /activity-log sayfasında (bkz.
            app-shell.tsx "Diğer" bölümü). */}
        {isAdmin && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Son Aktiviteler</CardTitle>
              <Link href="/activity-log" className="text-xs font-medium text-primary hover:underline">
                Tüm Günlük →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">Henüz aktivite yok.</p>
              )}
              {recentActivity.map((log) => (
                <div key={log.id} className="text-sm">
                  <p className="text-foreground/90">
                    <span className="font-medium text-foreground">
                      {log.user.name || log.user.email}
                    </span>{" "}
                    — {log.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.team.name} · {formatDate(log.createdAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "blue" | "red" | "green" | "slate" | "amber";
  /** Belirtilirse kart tıklanabilir olur ve o modüle götürür (bkz. "Modülleriniz" bölümü). */
  href?: string;
}) {
  const content = (
    <CardContent className="flex items-center gap-4 pt-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint-${tone} text-tint-${tone}-foreground transition-transform group-hover:scale-105`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-foreground">{value}</p>
      </span>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="group transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]">
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="group transition-shadow hover:shadow-[var(--shadow-card-hover)]">{content}</Card>
  );
}
