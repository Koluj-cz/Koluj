"use client";

import Link from "next/link";
import { CalendarDays, Home, Package, Plus, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const navItems = [
  {
    href: "/",
    label: "Domů",
    icon: Home,
    protected: false,
    match: (pathname: string) => pathname === "/",
  },
  {
    href: "/dashboard/my-offers",
    label: "Moje předměty",
    icon: Package,
    protected: true,
    match: (pathname: string) => pathname.startsWith("/dashboard/my-offers"),
  },
  {
    href: "/offers/new",
    label: "Přidat nabídku",
    icon: Plus,
    primary: true,
    protected: true,
    match: (pathname: string) => pathname.startsWith("/offers/new"),
  },
  {
    href: "/dashboard/bookings",
    label: "Rezervace",
    icon: CalendarDays,
    protected: true,
    match: (pathname: string) => pathname.startsWith("/dashboard/bookings"),
  },
  {
    href: "/dashboard",
    label: "Můj prostor",
    icon: User,
    protected: true,
    match: (pathname: string) =>
      pathname === "/dashboard" ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/dashboard/availability"),
  },
];

function loginRedirectHref(targetHref: string) {
  return `/login?redirectTo=${encodeURIComponent(targetHref)}`;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function syncSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setIsLoggedIn(Boolean(session));
      }
    }

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
    });

    window.addEventListener("focus", syncSession);
    document.addEventListener("visibilitychange", syncSession);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", syncSession);
      document.removeEventListener("visibilitychange", syncSession);
    };
  }, []);

  async function handleProtectedClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    targetHref: string,
    isProtected: boolean,
  ) {
    if (!isProtected) return;

    event.preventDefault();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      setIsLoggedIn(true);
      router.push(targetHref);
      return;
    }

    setIsLoggedIn(false);
    router.push(loginRedirectHref(targetHref));
  }

  return (
    <nav className="koluj-bottom-nav" aria-label="Mobilní navigace">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) =>
              handleProtectedClick(event, item.href, item.protected)
            }
            aria-label={item.label}
            title={item.label}
            data-primary={item.primary ? "true" : undefined}
            data-active={isActive ? "true" : undefined}
          >
            <Icon
              size={item.primary ? 28 : 21}
              strokeWidth={item.primary ? 2.4 : 2.2}
            />
          </Link>
        );
      })}
    </nav>
  );
}
