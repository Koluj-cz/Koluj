"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarOff, Heart, Handshake, Package, Plus, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AddOfferButton from "@/app/components/AddOfferButton";
import RestoreAccountOnLogin from "@/app/components/RestoreAccountOnLogin";

export default function DashboardPage() {
  const [fullName, setFullName] = useState("");
  const [profileComplete, setProfileComplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    loadProfile();
    loadUnreadNotifications();
  }, []);

  async function loadUnreadNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setUnreadNotifications(count || 0);
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingProfile(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("full_name, city, latitude, longitude")
      .eq("id", user.id)
      .single();

    setFullName(data?.full_name || "");
    setProfileComplete(Boolean(data?.full_name && data?.city && data?.latitude && data?.longitude));
    setLoadingProfile(false);
  }

  return (
    <main className="min-h-screen">
      <RestoreAccountOnLogin />
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link href="/" className="koluj-logo">KOLUJ</Link>
          <AddOfferButton className="koluj-button flex items-center gap-2 px-6 py-3" />
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
          <div>
            <p className="koluj-pill w-fit">Můj prostor</p>
            <h1 className="koluj-heading mt-6 max-w-[13ch]">
              {fullName ? `Ahoj, ${fullName.split(" ")[0]}.` : "Vítej zpět."}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Spravuj nabídky, rezervace a dostupnost na jednom přehledném místě.
            </p>
          </div>

          <div className="koluj-card overflow-hidden p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">Rychlá akce</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">Přidej novou nabídku</h2>
                <p className="mt-3 text-[var(--koluj-muted)]">Věc nebo službu můžeš začít nabízet během pár minut.</p>
              </div>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--koluj-green)] text-white shadow-[var(--koluj-glow)]"><Plus size={30} /></span>
            </div>
            <AddOfferButton className="koluj-button mt-8 w-full px-6 py-4" />
          </div>
        </section>

        {!loadingProfile && !profileComplete && (
          <section className="koluj-card mt-8 p-6 md:p-8">
            <p className="text-lg text-[var(--koluj-muted)]">
              <span className="font-black text-[var(--koluj-green)]">Dokonči profil:</span>{" "}
              doplň jméno a lokalitu, aby lidé věděli, s kým a kde se domlouvají.
            </p>
          </section>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard href="/dashboard/my-offers" title="Moje nabídky" icon={<Package />} text="Zobraz a spravuj věci a služby, které nabízíš." action="Otevřít" />
          <DashboardCard href="/dashboard/bookings" title="Rezervace" icon={<Handshake />} text="Schvaluj žádosti, řeš domluvu a stav rezervací." action="Spravovat" />
          <DashboardCard href="/dashboard/availability" title="Dostupnost" icon={<CalendarOff />} text="Zablokuj termíny pro jednu nebo více nabídek." action="Nastavit" />
          <DashboardCard href="/dashboard/notifications" title={unreadNotifications > 0 ? `Notifikace (${unreadNotifications})` : "Notifikace"} icon={<Bell />} text="Nové žádosti, zprávy a důležité události." action="Zobrazit" />
          <DashboardCard href="/profile" title="Profil" icon={<User />} text="Uprav kontakty, lokalitu, bio a nastavení účtu." action="Upravit" />
          <div className="koluj-card flex min-h-[240px] flex-col justify-between overflow-hidden p-8">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"><Heart size={26} /></span>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.05em]">Tip</h2>
              <p className="mt-3 text-[var(--koluj-muted)]">Aktuální fotky a jasný popis výrazně zvyšují šanci na rezervaci.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardCard({ href, title, icon, text, action }: { href: string; title: string; icon: React.ReactNode; text: string; action: string }) {
  return (
    <Link href={href} className="koluj-card group min-h-[240px] overflow-hidden p-8 transition hover:-translate-y-1 hover:shadow-[var(--koluj-shadow)]">
      <div className="flex items-start justify-between gap-6">
        <h2 className="text-3xl font-black tracking-[-0.05em]">{title}</h2>
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">{icon}</span>
      </div>
      <p className="mt-8 text-lg leading-relaxed text-[var(--koluj-muted)]">{text}</p>
      <p className="koluj-link mt-10">{action} →</p>
    </Link>
  );
}
