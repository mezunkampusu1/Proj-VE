import { prisma } from "@/lib/prisma";
import type { ActivityAction, ModuleName, NotificationType } from "@prisma/client";

interface LogActivityInput {
  teamId: string;
  userId: string;
  action: ActivityAction;
  message: string;
  projectId?: string;
  taskId?: string;
  module?: ModuleName;
  ipAddress?: string | null;
}

/** Aktivite akışına (işlem geçmişi) kayıt düşer. */
export async function logActivity(input: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      teamId: input.teamId,
      userId: input.userId,
      action: input.action,
      message: input.message,
      projectId: input.projectId,
      taskId: input.taskId,
      module: input.module,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}

interface NotifyInput {
  userId: string;
  title: string;
  message: string;
  link?: string;
  /** Bildirim merkezinde hangi ikon/vurgunun gösterileceğini belirler
   * (bkz. notification-bell.tsx). Belirtilmezse GENERAL (şema varsayılanı)
   * kullanılır. */
  type?: NotificationType;
}

/** Kullanıcıya bildirim oluşturur. */
export async function notifyUser(input: NotifyInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      link: input.link,
      type: input.type,
    },
  });
}

/**
 * Next.js Request nesnesinden istemci IP adresini çıkarır. Docker/reverse
 * proxy arkasında çalışırken gerçek istemci IP'si `x-forwarded-for`
 * başlığında taşınır.
 */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
