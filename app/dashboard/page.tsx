"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Package, User, Handshake, Bell, CalendarOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AddOfferButton from "@/app/components/AddOfferButton";
import AddOfferDashboardCard from "@/app/components/AddOfferDashboardCard";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setUnreadNotifications(count || 0);
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const complete = Boolean(
      data?.full_name &&
        data?.city &&
        data?.latitude &&
        data?.longitude
    );

    setProfileComplete(complete);
    setLoadingProfile(false);
  }

  return (
    <main className="min-h-screen">
      <RestoreAccountOnLogin />
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-4xl font-black tracking-tight text-[var(--koluj-green)]"
          >
            KOLUJ
          </Link>

        <AddOfferButton className="koluj-button flex items-center gap-2 px-6 py-3" />
        </header>

        <section className="mt-16 px-8">
          <h1 className="koluj-heading">
            {fullName ? `Vítej zpět, ${fullName}!` : "Vítej zpět!"}
          </h1>

          <p className="mt-6 text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Tvoje nabídky mohou někomu udělat radost.
            <br />
            Co chceš dnes udělat?
          </p>
        </section>

        {!loadingProfile && !profileComplete && (
          <section className="koluj-card mt-10 flex items-center justify-between px-8 py-6">
            <p className="text-lg text-[var(--koluj-muted)]">
              <span className="font-bold text-[var(--koluj-green)]">
                Nejdřív dokonči profil:
              </span>{" "}
              Potřebujeme jméno a lokalitu, aby bylo jasné, s kým a kde si lidé
              nabídku předávají.
            </p>
          </section>
        )}

        <section className="mt-14 grid gap-6 px-8 md:grid-cols-3">
          <DashboardCard
            href="/dashboard/my-offers"
            title="Moje nabídky"
            icon={<Package size={32} />}
            text="Zobraz a spravuj nabídky, které nabízíš k rezervaci."
            action="Otevřít"
          />

          <AddOfferDashboardCard />

          <DashboardCard
            href="/profile"
            title="Profil"
            icon={<User size={32} />}
            text="Uprav údaje, lokalitu a kontaktní informace."
            action="Upravit"
          />

          <DashboardCard
            href="/dashboard/bookings"
            title="Rezervace"
            icon={<Handshake size={32} />}
            text="Spravuj rezervace, žádosti a vrácení nabídek."
            action="Otevřít"
          />

          <DashboardCard
            href="/dashboard/notifications"
            title={
              unreadNotifications > 0
                ? `Notifikace (${unreadNotifications})`
                : "Notifikace"
            }
            icon={<Bell size={32} />}
            text="Zobraz nové žádosti, zprávy a důležité události."
            action="Zobrazit"
          />

          <DashboardCard
            href="/dashboard/availability"
            title="Dostupnost"
            icon={<CalendarOff size={32} />}
            text="Zablokuj termín pro jednu, více nebo všechny své nabídky."
            action="Spravovat"
          />
          
        </section>

        <section className="mt-10 rounded-3xl border border-[var(--koluj-border)] bg-white/70 p-5 md:flex md:items-center md:justify-between md:px-8 md:py-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
              Tip
            </p>

            <p className="mt-1 text-base leading-relaxed text-[var(--koluj-muted)] md:text-lg">
              Čím lépe popíšeš nabídku a podmínky předání, tím snadněji najde správného
              zájemce.
            </p>
          </div>

          <Heart
            size={28}
            className="mt-4 hidden text-[var(--koluj-green)] md:block"
          />
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  href,
  title,
  icon,
  text,
  action,
  disabled = false,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  text: string;
  action: string;
  disabled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`koluj-card group relative overflow-hidden p-8 transition ${
        disabled
          ? "opacity-55 grayscale hover:translate-y-0"
          : "hover:-translate-y-1"
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <h2 className="text-3xl font-black tracking-tight">{title}</h2>

        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
          {icon}
        </span>
      </div>

      <p className="mt-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
        {text}
      </p>

      <p className="koluj-link mt-14">{action} →</p>

      <div className="absolute bottom-0 right-0 h-24 w-40 rounded-tl-full bg-[var(--koluj-bg)] opacity-70" />
    </Link>
  );
}