"use client";

import Link from "next/link";
import { CalendarDays, Home, Package, Plus, User } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Domů", icon: Home, match: (p: string) => p === "/" },
  { href: "/dashboard/my-offers", label: "Moje předměty", icon: Package, match: (p: string) => p.startsWith("/dashboard/my-offers") },
  { href: "/offers/new", label: "Přidat nabídku", icon: Plus, primary: true, match: (p: string) => p.startsWith("/offers/new") },
  { href: "/dashboard/bookings", label: "Rezervace", icon: CalendarDays, match: (p: string) => p.startsWith("/dashboard/bookings") },
  {
    href: "/dashboard",
    label: "Můj prostor",
    icon: User,
    match: (p: string) =>
      p === "/dashboard" ||
      p.startsWith("/profile") ||
      p.startsWith("/dashboard/availability"),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="koluj-bottom-nav" aria-label="Mobilní navigace">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            data-primary={item.primary ? "true" : undefined}
            data-active={isActive ? "true" : undefined}
          >
            <Icon size={item.primary ? 28 : 21} strokeWidth={item.primary ? 2.4 : 2.2} />
          </Link>
        );
      })}
    </nav>
  );
}