import Link from "next/link";
import { CalendarDays, Home, Plus, Search, User } from "lucide-react";

export default function BottomNav() {
  return (
    <nav className="koluj-bottom-nav" aria-label="Mobilní navigace">
      <Link href="/">
        <Home size={19} />
      </Link>
      <Link href="/offers">
        <Search size={20} />
      </Link>
      <Link href="/offers/new" data-primary="true" aria-label="Přidat nabídku">
        <Plus size={27} />
      </Link>
      <Link href="/dashboard/bookings">
        <CalendarDays size={20} />
      </Link>
      <Link href="/dashboard">
        <User size={20} />
      </Link>
    </nav>
  );
}
