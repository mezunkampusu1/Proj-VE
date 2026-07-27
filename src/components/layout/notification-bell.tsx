"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { notificationTypeMeta, type NotificationItem } from "@/components/layout/notification-meta";

type Notification = NotificationItem;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  useEffect(() => {
    // Revizyon: "websocket bağlı değil gibi anlık düşmüyor f5 gerekiyor" —
    // genel uygulamada gerçek bir WebSocket altyapısı yok (yalnızca Ortak
    // Alan'ın Yjs/Hocuspocus'u var), bu yüzden aynı yoklama (polling)
    // deseni kullanılıyor ama aralık 30sn'den 8sn'ye indirildi ki
    // bildirimler neredeyse anlık gibi hissettirsin. Ayrıca sekme/pencere
    // tekrar odaklandığında (örn. başka sekmede bildirim tetiklendikten
    // sonra bu sekmeye dönüldüğünde) beklemeden hemen tazelenir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 8000);
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", { method: "PATCH" });
  }

  function markOneRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Bildirimler"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-popover)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Bildirimler</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  {unreadCount} yeni
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>
              </div>
            )}
            {notifications.map((n) => {
              const meta = notificationTypeMeta[n.type] ?? notificationTypeMeta.GENERAL;
              const Icon = meta.icon;
              return (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => {
                    markOneRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent ${
                    n.read ? "" : "bg-primary/[0.04]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`truncate ${n.read ? "font-medium text-foreground/80" : "font-semibold text-foreground"}`}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">{n.message}</span>
                    <span className="mt-1 block text-xs text-muted-foreground/80">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
