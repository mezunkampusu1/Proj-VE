import {
  Bell,
  CheckCircle2,
  MessageSquare,
  AtSign,
  Repeat,
  Paperclip,
  UserPlus,
  Timer,
  Share2,
  BadgeCheck,
  FileText,
  Wallet,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ClipboardX,
  XCircle,
} from "lucide-react";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_COMMENT"
  | "TASK_MENTIONED"
  | "RECURRING_ASSIGNED"
  | "FILE_MENTIONED"
  | "ANNOUNCEMENT_MENTIONED"
  | "IMPORTANT_DATE_MENTIONED"
  | "ATLAS_PROGRAM_MENTIONED"
  | "TEAM_INVITED"
  | "DAILY_FLOW_EVENT"
  | "DOCUMENT_SHARED"
  | "DOCUMENT_MENTIONED"
  | "DOCUMENT_COMMENT"
  | "DOCUMENT_APPROVAL"
  | "DOCUMENT_UPDATE"
  | "FINANCE_PAYMENT_DUE"
  | "FINANCE_PAYMENT_OVERDUE"
  | "PROJECT_MENTIONED"
  // Modül 9 — Sosyal Medya, İçerik ve SEO Yönetimi (bkz. prisma/schema.prisma NotificationType)
  | "CONTENT_MENTIONED"
  | "CONTENT_ASSIGNED"
  | "CONTENT_COMMENT"
  | "CONTENT_REVISION_REQUESTED"
  | "CONTENT_APPROVED"
  | "CONTENT_REJECTED"
  | "CONTENT_PUBLISH_REMINDER"
  | "CONTENT_DEADLINE_REMINDER"
  | "DAILY_WORK_REPORT_APPROVED"
  | "DAILY_WORK_REPORT_REVISION"
  | "GENERAL";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Bildirim türüne göre ikon + vurgu rengi — bildirim merkezinde (hem zil
 * menüsünde hem tam sayfada) her satırın ne hakkında olduğunu tek bakışta
 * ayırt edebilmek için (bkz. Notification modeli, notifyUser çağrı
 * yerleri).
 */
export const notificationTypeMeta: Record<
  NotificationType,
  { icon: typeof Bell; className: string }
> = {
  TASK_ASSIGNED: { icon: CheckCircle2, className: "bg-tint-blue text-tint-blue-foreground" },
  TASK_COMMENT: { icon: MessageSquare, className: "bg-tint-slate text-tint-slate-foreground" },
  TASK_MENTIONED: { icon: AtSign, className: "bg-tint-violet text-tint-violet-foreground" },
  RECURRING_ASSIGNED: { icon: Repeat, className: "bg-tint-amber text-tint-amber-foreground" },
  FILE_MENTIONED: { icon: Paperclip, className: "bg-tint-green text-tint-green-foreground" },
  ANNOUNCEMENT_MENTIONED: { icon: AtSign, className: "bg-tint-violet text-tint-violet-foreground" },
  IMPORTANT_DATE_MENTIONED: { icon: AtSign, className: "bg-tint-blue text-tint-blue-foreground" },
  ATLAS_PROGRAM_MENTIONED: { icon: AtSign, className: "bg-tint-green text-tint-green-foreground" },
  TEAM_INVITED: { icon: UserPlus, className: "bg-primary/15 text-primary" },
  DAILY_FLOW_EVENT: { icon: Timer, className: "bg-tint-blue text-tint-blue-foreground" },
  DOCUMENT_SHARED: { icon: Share2, className: "bg-tint-violet text-tint-violet-foreground" },
  DOCUMENT_MENTIONED: { icon: AtSign, className: "bg-tint-amber text-tint-amber-foreground" },
  DOCUMENT_COMMENT: { icon: MessageSquare, className: "bg-tint-slate text-tint-slate-foreground" },
  DOCUMENT_APPROVAL: { icon: BadgeCheck, className: "bg-tint-green text-tint-green-foreground" },
  DOCUMENT_UPDATE: { icon: FileText, className: "bg-tint-red text-tint-red-foreground" },
  FINANCE_PAYMENT_DUE: { icon: Wallet, className: "bg-tint-amber text-tint-amber-foreground" },
  FINANCE_PAYMENT_OVERDUE: { icon: AlertTriangle, className: "bg-tint-red text-tint-red-foreground" },
  PROJECT_MENTIONED: { icon: AtSign, className: "bg-tint-blue text-tint-blue-foreground" },
  CONTENT_MENTIONED: { icon: AtSign, className: "bg-tint-violet text-tint-violet-foreground" },
  CONTENT_ASSIGNED: { icon: CheckCircle2, className: "bg-tint-blue text-tint-blue-foreground" },
  CONTENT_COMMENT: { icon: MessageSquare, className: "bg-tint-slate text-tint-slate-foreground" },
  CONTENT_REVISION_REQUESTED: { icon: ClipboardX, className: "bg-tint-amber text-tint-amber-foreground" },
  CONTENT_APPROVED: { icon: BadgeCheck, className: "bg-tint-green text-tint-green-foreground" },
  CONTENT_REJECTED: { icon: XCircle, className: "bg-tint-red text-tint-red-foreground" },
  CONTENT_PUBLISH_REMINDER: { icon: CalendarClock, className: "bg-tint-blue text-tint-blue-foreground" },
  CONTENT_DEADLINE_REMINDER: { icon: AlertTriangle, className: "bg-tint-red text-tint-red-foreground" },
  DAILY_WORK_REPORT_APPROVED: { icon: ClipboardCheck, className: "bg-tint-green text-tint-green-foreground" },
  DAILY_WORK_REPORT_REVISION: { icon: ClipboardX, className: "bg-tint-amber text-tint-amber-foreground" },
  GENERAL: { icon: Bell, className: "bg-muted text-muted-foreground" },
};
