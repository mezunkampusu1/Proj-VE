import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/activity";
import type { NotificationType } from "@prisma/client";

type PreferenceKey = "onShared" | "onMentioned" | "onComment" | "onApproval" | "onStatusChange";

const DEFAULT_PREF: Record<PreferenceKey, boolean> = {
  onShared: true,
  onMentioned: true,
  onComment: true,
  onApproval: true,
  onStatusChange: true,
};

/**
 * `Notification.type` değerini tercih anahtarına eşler. `GENERAL` ve
 * modül-dışı türler (TASK_*, FILE_MENTIONED, vb.) buradan geçmez — bu
 * yardımcı yalnızca Ortak Alan bildirimleri için kullanılır.
 */
const TYPE_TO_PREF_KEY: Partial<Record<NotificationType, PreferenceKey>> = {
  DOCUMENT_SHARED: "onShared",
  DOCUMENT_MENTIONED: "onMentioned",
  DOCUMENT_COMMENT: "onComment",
  DOCUMENT_APPROVAL: "onApproval",
  DOCUMENT_UPDATE: "onStatusChange",
};

/**
 * Ortak Alan olayları için `notifyUser`'ın tercih-farkında sarmalayıcısı
 * (§ bildirim türleri + tercihleri). Kullanıcının tercih satırı yoksa
 * alan bazlı varsayılanlar (hepsi açık) geçerli olur — Daily Flow
 * modülündeki `notifyAdminsForDailyFlowEvent` ile AYNI desen (bkz.
 * src/lib/daily-flow.ts), burada admin'e özel değil, herhangi bir üyeye
 * gönderilebildiği için ayrı bir yardımcı olarak tutuldu.
 */
export async function notifyDocumentUser(input: {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type: NotificationType;
}) {
  const prefKey = TYPE_TO_PREF_KEY[input.type];
  if (prefKey) {
    const pref = await prisma.documentNotificationPreference.findUnique({
      where: { userId: input.userId },
    });
    const enabled = pref ? pref[prefKey] : DEFAULT_PREF[prefKey];
    if (!enabled) return null;
  }
  return notifyUser(input);
}
