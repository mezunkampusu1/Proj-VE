"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { notificationTypeMeta, type NotificationItem } from "@/components/layout/notification-meta";

/**
 * Tam "Bildirimler" sayfasının içeriği — sunucudan gelen ilk listeyi alır,
 * ardından okundu işaretlemeyi (tekli/tümü) istemci tarafında yönetir.
 * Aynı görsel dil (tür ikonu, göreceli zaman, okunmamış noktası)
 * notification-bell.tsx ile paylaşılır.
 */
export function NotificationList({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH" });
  }

  function markOneRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bildirimler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Size atanan görevler, etiketlemeler ve diğer güncellemeler.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {notifications.map((n) => {
            const meta = notificationTypeMeta[n.type] ?? notificationTypeMeta.GENERAL;
            const Icon = meta.icon;
            return (
              <Link
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => markOneRead(n.id)}
                className={`flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent ${
                  n.read ? "" : "bg-primary/[0.04]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`text-sm ${n.read ? "font-medium text-foreground/80" : "font-semibold text-foreground"}`}
                    >
                      {n.title}
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
                  <span className="mt-1 block text-xs text-muted-foreground/80">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
