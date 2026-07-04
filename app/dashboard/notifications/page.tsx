"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/app/components/PageLoader";

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
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 5;
export default function NotificationsPage() {

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [page]);

  async function loadNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, count } = await supabase
      .from("notifications")
      .select(
        `
        *,
        actor:profiles!notifications_actor_id_fkey (
          full_name,
          avatar_url
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, page * PAGE_SIZE - 1);

    setNotifications((data || []) as unknown as Notification[]);
    setTotalCount(count || 0);

    await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setLoading(false);
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <p className="koluj-pill w-fit bg-[var(--koluj-green-pale)] text-[var(--koluj-green)]">
            Můj prostor
          </p>

          <div className="mt-6 flex items-center gap-3">
            <Bell size={32} />
            <h1 className="koluj-heading">Notifikace</h1>
          </div>

          <p className="mt-5 text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Zobrazeno {notifications.length} z {totalCount}
          </p>
        </section>

        {loading ? (
          <PageLoader />
        ) : notifications.length === 0 ? (
          <div className="koluj-card mt-8 p-8">
            Zatím nemáš žádné notifikace.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {notifications.map((notification) => {
              const actorName = notification.actor?.full_name || "Uživatel";
              const actorInitial = actorName.charAt(0).toUpperCase();

              return (
                <div
                  key={notification.id}
                  className="koluj-card p-5 hover:border-[var(--koluj-green)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      {notification.actor_id ? (
                        <Link
                          href={`/users/${notification.actor_id}`}
                          className="shrink-0"
                        >
                          {notification.actor?.avatar_url ? (
                            <img
                              src={notification.actor.avatar_url}
                              alt={actorName}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
                              {actorInitial}
                            </div>
                          )}
                        </Link>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
                          <Bell size={20} />
                        </div>
                      )}

                      <div>
                        <p className="font-black">{notification.title}</p>

                        <p className="mt-2 text-[var(--koluj-muted)]">
                          {notification.actor_id ? (
                            <>
                              <Link
                                href={`/users/${notification.actor_id}`}
                                className="font-bold text-[var(--koluj-green)] hover:underline"
                              >
                                {actorName}
                              </Link>{" "}
                              {notification.message}
                            </>
                          ) : (
                            notification.message
                          )}
                        </p>

                        <p className="mt-3 text-sm text-[var(--koluj-muted)]">
                          {formatDateTime(notification.created_at)}
                        </p>

                        {notification.booking_id && (
                          <Link
                            href={`/dashboard/bookings/${notification.booking_id}`}
                            className="koluj-link mt-3 inline-block"
                          >
                            Otevřít rezervaci →
                          </Link>
                        )}
                        {!notification.booking_id && notification.offer_id && (
                          <Link
                            href={`/offers/${notification.offer_id}`}
                            className="koluj-link mt-3 inline-block"
                          >
                            Otevřít nabídku →
                          </Link>
                        )}
                      </div>
                    </div>

                    {!notification.is_read && (
                      <div className="h-3 w-3 shrink-0 rounded-full bg-[var(--koluj-green)]" />
                    )}
                  </div>
                </div>
              );
            })}
            {notifications.length < totalCount && (
              <button
                type="button"
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="koluj-button w-full px-6 py-3"
              >
                Načíst další
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}