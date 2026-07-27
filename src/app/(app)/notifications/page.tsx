import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationList } from "@/components/layout/notification-list";

export default async function NotificationsPage() {
  const session = await auth();
  const notifications = await prisma.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <NotificationList
        initialNotifications={notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
