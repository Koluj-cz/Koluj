"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Lock, Package, Plus, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [fullName, setFullName] = useState("");
  const [profileComplete, setProfileComplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

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
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-4xl font-black tracking-tight text-[var(--koluj-green)]"
          >
            KOLUJ
          </Link>

          {profileComplete ? (
            <Link href="/items/new" className="koluj-button px-6 py-3">
              + Přidat věc
            </Link>
          ) : (
            <Link
              href="/profile"
              className="rounded-2xl border border-[var(--koluj-border)] bg-[var(--koluj-surface)] px-6 py-3 font-bold text-[var(--koluj-muted)] transition hover:bg-[var(--koluj-bg)]"
            >
              Dokončit profil
            </Link>
          )}
        </header>

        <section className="mt-16 px-8">
          <h1 className="koluj-heading">
            {fullName ? `Vítej zpět, ${fullName}!` : "Vítej zpět!"}
          </h1>

          <p className="mt-6 text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Tvoje věci mohou někomu udělat radost.
            <br />
            Co chceš dnes udělat?
          </p>
        </section>

        {!loadingProfile && !profileComplete && (
          <section className="koluj-card mx-8 mt-10 px-8 py-6">
            <p className="text-lg text-[var(--koluj-muted)]">
              <span className="font-bold text-[var(--koluj-green)]">
                Nejdřív dokonči profil:
              </span>{" "}
              Potřebujeme jméno a lokalitu, aby bylo jasné, s kým a kde si lidé
              věc předávají.
            </p>
          </section>
        )}

        <section className="mt-14 grid gap-6 px-8 md:grid-cols-3">
          <DashboardCard
            href="/dashboard/my-items"
            title="Moje věci"
            icon={<Package size={32} />}
            text="Zobraz a spravuj věci, které nabízíš k půjčení."
            action="Otevřít"
          />

          <DashboardCard
            href={profileComplete ? "/items/new" : "/profile"}
            title="Přidat věc"
            icon={profileComplete ? <Plus size={32} /> : <Lock size={32} />}
            text={
              profileComplete
                ? "Přidej novou věc, kterou chceš nabídnout ostatním."
                : "Nejdřív dokonči profil, aby lidé věděli, s kým a kde si věc předávají."
            }
            action={profileComplete ? "Přidat" : "Dokončit profil"}
            disabled={!profileComplete}
          />

          <DashboardCard
            href="/profile"
            title="Profil"
            icon={<User size={32} />}
            text="Uprav údaje, lokalitu a kontaktní informace."
            action="Upravit"
          />
        </section>

        <section className="koluj-card mt-10 flex items-center justify-between px-8 py-6">
          <p className="text-lg text-[var(--koluj-muted)]">
            <span className="font-bold text-[var(--koluj-green)]">Tip:</span>{" "}
            Čím lépe popíšeš věc a podmínky předání, tím snadněji najde
            správného zájemce.
          </p>

          <Heart
            size={28}
            className="hidden text-[var(--koluj-green)] md:block"
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