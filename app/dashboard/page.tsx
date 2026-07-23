"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarOff,
  BarChart3,
  ShieldCheck,
  Users,
  FileBarChart,
  Handshake,
  Package,
  Plus,
  User,
} from "lucide-react";
import BackLink from "@/app/components/BackLink";
import NotificationBell from "@/app/components/NotificationBell";

export default function DashboardPage() {
  const [fullName, setFullName] = useState("");
  const [profileComplete, setProfileComplete] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadProfile = useCallback(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setLoadingProfile(false);
      return;
    }

    setFullName(result?.profile?.full_name || "");
    setIsModerator((result?.user?.email || "").toLowerCase() === "info@koluj.cz");
    setProfileComplete(Boolean(result?.profileComplete));
    setLoadingProfile(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card koluj-hero-card-popover p-5 md:p-8 xl:p-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <BackLink href="/" hideOnMobile>Domů</BackLink>
            <NotificationBell />
          </div>

          <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col justify-center">
              <h1 className="koluj-heading max-w-[12ch]">
                {fullName ? `Ahoj, ${fullName.split(" ")[0]}.` : "Vítej zpět."}
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
                Spravuj nabídky, rezervace, dostupnost i profil na jednom přehledném místě.
              </p>
            </div>
          </div>
        </section>

        {!loadingProfile && !profileComplete && (
          <section className="koluj-card mt-6 p-5 md:p-6">
            <p className="text-base leading-relaxed text-[var(--koluj-muted)] md:text-lg">
              <span className="font-black text-[var(--koluj-green)]">
                Dokonči profil:
              </span>{" "}
              doplň jméno a lokalitu, aby lidé věděli, s kým a kde se domlouvají.
            </p>
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCard
            href="/offers/new"
            title="Přidat nabídku"
            icon={<Plus />}
            text="Vytvoř novou věc nebo službu, kterou můžeš nabídnout ostatním."
            action="Přidat"
            featured
          />

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

          <DashboardCard
            href="/dashboard/performance"
            title="Výkon nabídek"
            icon={<BarChart3 />}
            text="Sleduj zájem o nabídky a konkrétní doporučení ke zlepšení."
            action="Zobrazit"
          />

          {isModerator && (
            <>
              <div className="md:col-span-2 xl:col-span-3 mt-4 rounded-3xl border border-violet-200 bg-violet-50/80 p-4 md:p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Administrace Koluj.cz</p>
                <p className="mt-1 text-sm font-bold text-violet-900/70">Tyto nástroje jsou dostupné pouze administrátorům.</p>
              </div>
              <DashboardCard href="/dashboard/moderation" title="Moderace" icon={<ShieldCheck />} text="Schvaluj nejistá média, řeš technické chyby a spravuj zamítnutý obsah." action="Otevřít frontu" admin />
              <DashboardCard href="/dashboard/admin/users" title="Uživatelé" icon={<Users />} text="Přehled účtů, aktivity a možnost uživatele zablokovat nebo odblokovat." action="Spravovat uživatele" admin />
              <DashboardCard href="/dashboard/admin/reports" title="Měsíční reporty" icon={<FileBarChart />} text="Historie reportů, statistiky moderace a ruční spuštění reportu." action="Otevřít reporty" admin />
            </>
          )}
        </section>

        <DashboardFooter />
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
  featured = false,
  admin = false,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  text: string;
  action: string;
  featured?: boolean;
  admin?: boolean;
}) {
  const isProtectedHref =
    href.startsWith("/dashboard") ||
    href.startsWith("/profile") ||
    href.startsWith("/offers/new");

  return (
    <Link
      href={href}
      prefetch={isProtectedHref ? false : undefined}
      className={`koluj-card group flex min-h-[210px] flex-col justify-between overflow-hidden p-6 md:p-8 ${
        featured ? "bg-gradient-to-br from-white to-[var(--koluj-green-pale)] hover:border-[var(--koluj-green)]" : "hover:border-[var(--koluj-green)]"
      } ${admin ? "border-violet-200 bg-gradient-to-br from-white to-violet-50 hover:border-violet-500" : ""}`}
    >
      <div>
        <div className="flex items-start justify-between gap-5">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[var(--koluj-ink)] md:text-3xl">
            {title}
          </h2>

          <span className={`koluj-icon-bubble shrink-0 ${admin ? "bg-violet-100 text-violet-700" : ""}`}>{icon}</span>
        </div>

        <p className="mt-5 leading-relaxed text-[var(--koluj-muted)] md:text-lg">
          {text}
        </p>
      </div>

      <p className={`koluj-link mt-6 flex items-center gap-2 ${admin ? "text-violet-700" : ""}`}>
        {action} <ArrowRight size={17} />
      </p>
    </Link>
  );
}

function DashboardFooter() {
  return (
    <footer className="koluj-card mt-8 p-5 md:mt-10 md:p-6">
      <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-black text-[var(--koluj-muted)]">
        <Link href="/legal/terms" className="hover:text-[var(--koluj-green)]">
          Podmínky
        </Link>

        <Link href="/legal/privacy" className="hover:text-[var(--koluj-green)]">
          Soukromí
        </Link>

        <Link href="/legal/cookies" className="hover:text-[var(--koluj-green)]">
          Cookies
        </Link>

        <a href="mailto:info@koluj.cz" className="hover:text-[var(--koluj-green)]">
          Kontakt
        </a>
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--koluj-muted)] opacity-70">
        © {new Date().getFullYear()} Koluj
      </p>
    </footer>
  );
}
