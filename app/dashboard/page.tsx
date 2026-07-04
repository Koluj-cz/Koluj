"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarOff, Heart, Handshake, Package, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import RestoreAccountOnLogin from "@/app/components/RestoreAccountOnLogin";
import BackLink from "@/app/components/BackLink";
import NotificationBell from "@/app/components/NotificationBell";

export default function DashboardPage() {
  const [fullName, setFullName] = useState("");
  const [profileComplete, setProfileComplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

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
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <RestoreAccountOnLogin />

      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card grid gap-6 p-5 md:p-8 xl:grid-cols-[0.8fr_1.2fr] xl:p-10">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <BackLink href="/">Domů</BackLink>
                <p className="koluj-pill w-fit bg-[var(--koluj-green-pale)] text-[var(--koluj-green)]">
                  Můj prostor
                </p>
              </div>
              <NotificationBell />
            </div>

            <h1 className="koluj-heading mt-6 max-w-[12ch]">
              {fullName ? `Ahoj, ${fullName.split(" ")[0]}.` : "Vítej zpět."}
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
              Spravuj nabídky, rezervace, dostupnost i profil na jednom přehledném místě.
            </p>
          </div>

          <div className="koluj-card flex flex-col justify-between p-6 md:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                Přehled účtu
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--koluj-ink)] md:text-3xl">
                Vše důležité pro kolování.
              </h2>
              <p className="mt-3 text-[var(--koluj-muted)]">
                Zkontroluj nové rezervace, uprav svoje nabídky nebo doplň profil, aby se s tebou lidem lépe domlouvalo.
              </p>
            </div>

            {!loadingProfile && !profileComplete && (
              <Link href="/profile" className="koluj-button mt-6 w-fit min-h-[52px] px-6">
                Dokončit profil <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </section>

        {!loadingProfile && !profileComplete && (
          <section className="koluj-card mt-6 p-5 md:p-6">
            <p className="text-base leading-relaxed text-[var(--koluj-muted)] md:text-lg">
              <span className="font-black text-[var(--koluj-green)]">Dokonči profil:</span>{" "}
              doplň jméno a lokalitu, aby lidé věděli, s kým a kde se domlouvají.
            </p>
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard
            href="/dashboard/my-offers"
            title="Moje nabídky"
            icon={<Package />}
            text="Zobraz a spravuj věci a služby, které nabízíš."
            action="Otevřít"
          />
          <DashboardCard
            href="/dashboard/bookings"
            title="Rezervace"
            icon={<Handshake />}
            text="Schvaluj žádosti, řeš domluvu a stav rezervací."
            action="Spravovat"
          />
          <DashboardCard
            href="/dashboard/availability"
            title="Dostupnost"
            icon={<CalendarOff />}
            text="Zablokuj termíny pro jednu nebo více nabídek."
            action="Nastavit"
          />
          <DashboardCard
            href="/profile"
            title="Profil"
            icon={<User />}
            text="Uprav kontakty, lokalitu, bio a nastavení účtu."
            action="Upravit"
          />

          <div className="koluj-card flex min-h-[210px] flex-col justify-between overflow-hidden p-6 md:p-8">
            <div>
              <span className="koluj-icon-bubble">
                <Heart size={26} />
              </span>
              <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--koluj-ink)] md:text-3xl">
                Tip
              </h2>
              <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
                Aktuální fotky a jasný popis výrazně zvyšují šanci na rezervaci.
              </p>
            </div>
          </div>
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
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  text: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="koluj-card group flex min-h-[210px] flex-col justify-between overflow-hidden p-6 hover:border-[var(--koluj-green)] md:p-8"
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[var(--koluj-ink)] md:text-3xl">
            {title}
          </h2>
          <span className="koluj-icon-bubble shrink-0">
            {icon}
          </span>
        </div>

        <p className="mt-5 leading-relaxed text-[var(--koluj-muted)] md:text-lg">
          {text}
        </p>
      </div>

      <p className="koluj-link mt-6 flex items-center gap-2">
        {action} <ArrowRight size={17} />
      </p>
    </Link>
  );
}
