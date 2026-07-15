"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  booking_id: string | null;
  offer_id: string | null;
  actor_id: string | null;
  actor: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};


export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadNotifications(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClick(event: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function loadNotifications(markAsRead: boolean) {
    setLoading(true);

    const response = await fetch(
      `/api/notifications${markAsRead ? "?markAsRead=true" : ""}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const result = await response.json().catch(() => null);
    const loadedNotifications = (result?.notifications || []) as Notification[];

    setNotifications(loadedNotifications);
    setUnreadCount(Number(result?.unreadCount || 0));
    setLoading(false);
  }

  async function togglePanel() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) await loadNotifications(true);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={togglePanel}
        className="koluj-notification-button"
        aria-label="Notifikace"
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="koluj-notification-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="koluj-notification-panel" role="dialog" aria-label="Notifikace">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--koluj-border)] px-5 py-4">
            <div>
              <p className="text-lg font-black text-[var(--koluj-ink)]">Notifikace</p>
              <p className="text-sm font-bold text-[var(--koluj-muted)]">Poslední události v účtu</p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-muted)] hover:bg-[var(--koluj-green-pale)] hover:text-[var(--koluj-green)]"
              aria-label="Zavřít notifikace"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[min(480px,70vh)] overflow-y-auto p-3">
            {loading ? (
              <div className="p-5 text-sm font-bold text-[var(--koluj-muted)]">Načítám notifikace...</div>
            ) : notifications.length === 0 ? (
              <div className="p-5 text-sm font-bold text-[var(--koluj-muted)]">Zatím nemáš žádné notifikace.</div>
            ) : (
              <div className="grid gap-2">
                {notifications.map((notification) => {
                  const actorName = notification.actor?.full_name || "Uživatel";
                  const actorInitial = actorName.charAt(0).toUpperCase();
                  const href = notification.booking_id
                    ? `/dashboard/bookings/${notification.booking_id}`
                    : notification.offer_id
                      ? `/offers/${notification.offer_id}`
                      : null;

                  const content = (
                    <div className="flex gap-3 rounded-2xl p-3 hover:bg-[var(--koluj-green-pale)]">
                      {notification.actor?.avatar_url ? (
                        <img
                          src={notification.actor.avatar_url}
                          alt={actorName}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-green-pale)] text-sm font-black text-[var(--koluj-green)]">
                          {notification.actor_id ? actorInitial : <Bell size={17} />}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-black leading-snug text-[var(--koluj-ink)]">{notification.title}</p>
                          {!notification.is_read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--koluj-green)]" />}
                        </div>

                        <p className="mt-1 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
                          {notification.message}
                        </p>

                        <p className="mt-2 text-xs font-bold text-[var(--koluj-muted)]">
                          {formatDateTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  );

                  return href ? (
                    <Link key={notification.id} href={href} onClick={() => setIsOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
