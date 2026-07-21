"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Eye, Gauge, Lightbulb, Package, Star } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import PageLoader from "@/app/components/PageLoader";

type PerformanceData = {
  summary: {
    activeOffers: number;
    totalViews: number;
    completedBookings: number;
    successRate: number;
  };
  rating: { rating_avg: number | null; rating_count: number | null } | null;
  offerPerformance: {
    id: string;
    title: string;
    primaryImageUrl: string | null;
    publicationStatus: string | null;
    views: number;
    bookings: number;
    conversion: number;
  }[];
  activity: { label: string; count: number }[];
  recommendations: {
    title: string;
    text: string;
    href: string;
    actionLabel: string;
    priority: "attention" | "tip" | "good";
  }[];
};

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/dashboard/performance", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || "Statistiky se nepodařilo načíst");
        setData(result as PerformanceData);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Statistiky se nepodařilo načíst"));
  }, []);

  const maxActivity = useMemo(
    () => Math.max(1, ...(data?.activity.map((item) => item.count) || [1])),
    [data],
  );

  if (!data && !error) return <main className="min-h-screen"><PageLoader /></main>;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <BackLink href="/dashboard" hideOnMobile>Dashboard</BackLink>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="koluj-heading">Výkon nabídek</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
                Sleduj, co lidé otevírají, co si rezervují a kde můžeš nabídku ještě vylepšit.
              </p>
            </div>
            <span className="koluj-icon-bubble"><BarChart3 size={28} /></span>
          </div>
        </section>

        {error ? (
          <section className="koluj-card mt-6 p-8 text-center">
            <h2 className="text-2xl font-black">Statistiky nejsou dostupné</h2>
            <p className="mt-2 text-[var(--koluj-muted)]">{error}</p>
          </section>
        ) : data && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<Eye />} label="Zobrazení nabídek" value={data.summary.totalViews} />
              <Metric icon={<Package />} label="Aktivní nabídky" value={data.summary.activeOffers} />
              <Metric icon={<Gauge />} label="Úspěšné rezervace" value={`${data.summary.successRate} %`} />
              <Metric icon={<Star />} label="Hodnocení" value={data.rating?.rating_count ? Number(data.rating.rating_avg).toFixed(1) : "Nový"} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="koluj-card p-5 md:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--koluj-green)]">Po nabídkách</p>
                    <h2 className="mt-2 text-2xl font-black md:text-3xl">Co přitahuje nejvíc zájmu</h2>
                  </div>
                  <Link href="/dashboard/my-offers" className="koluj-link hidden items-center gap-2 sm:flex">Moje nabídky <ArrowRight size={17} /></Link>
                </div>

                <div className="mt-6 space-y-3">
                  {data.offerPerformance.length === 0 ? (
                    <p className="rounded-2xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">Přidej první nabídku a statistiky se začnou plnit.</p>
                  ) : data.offerPerformance.map((offer, index) => (
                    <Link key={offer.id} href={`/offers/${offer.id}`} className="flex items-center gap-4 rounded-2xl border border-[var(--koluj-border)] p-3 transition hover:border-[var(--koluj-green)]">
                      <span className="w-6 text-center text-sm font-black text-[var(--koluj-muted)]">{index + 1}.</span>
                      <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--koluj-bg)]">
                        {offer.primaryImageUrl && <Image src={offer.primaryImageUrl} alt="" fill sizes="64px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{offer.title}</p>
                        <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">{offer.views} zobrazení · {offer.bookings} rezervací</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black text-[var(--koluj-green)]">{offer.conversion} %</p>
                        <p className="text-xs font-bold text-[var(--koluj-muted)]">konverze</p>
                      </div>
                    </Link>
                  ))}
                </div>
                {data.offerPerformance.length > 0 && (
                  <p className="mt-5 text-sm leading-relaxed text-[var(--koluj-muted)]">
                    Konverze ukazuje, kolik rezervací vzniklo v poměru k počtu zobrazení nabídky.
                  </p>
                )}
              </div>

              <div className="koluj-card p-5 md:p-8">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--koluj-green)]">Rezervace</p>
                <h2 className="mt-2 text-2xl font-black">Nové rezervace za posledních 6 měsíců</h2>
                <div className="mt-8 flex h-56 items-end gap-3">
                  {data.activity.map((item) => (
                    <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                      <span className="mb-2 text-sm font-black">{item.count}</span>
                      <div className="mx-auto w-full max-w-12 rounded-t-xl bg-[var(--koluj-green)]" style={{ height: `${Math.max(8, (item.count / maxActivity) * 150)}px` }} />
                      <span className="mt-3 truncate text-xs font-black uppercase text-[var(--koluj-muted)]">{item.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-[var(--koluj-muted)]">
                  Graf zobrazuje počet nových rezervací vytvořených u tvých nabídek v jednotlivých měsících.
                </p>
              </div>
            </section>

            <section className="koluj-card mt-6 p-5 md:p-8">
              <div className="flex items-center gap-3">
                <span className="koluj-icon-bubble"><Lightbulb size={22} /></span>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--koluj-green)]">Doporučení</p>
                  <h2 className="mt-1 text-2xl font-black">Co můžeš udělat teď</h2>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {data.recommendations.map((item) => (
                  <Link
                    key={`${item.title}-${item.href}`}
                    href={item.href}
                    className={`rounded-2xl border p-5 transition hover:border-[var(--koluj-green)] ${recommendationClassName(item.priority)}`}
                  >
                    <p className={`text-xs font-black uppercase tracking-[0.12em] ${recommendationLabelClassName(item.priority)}`}>
                      {recommendationLabel(item.priority)}
                    </p>
                    <h3 className="mt-2 font-black">{item.title}</h3>
                    <p className="mt-2 leading-relaxed text-[var(--koluj-muted)]">{item.text}</p>
                    <p className="koluj-link mt-4 flex items-center gap-2">{item.actionLabel} <ArrowRight size={16} /></p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="koluj-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[var(--koluj-muted)]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--koluj-ink)]">{value}</p>
        </div>
        <span className="koluj-icon-bubble">{icon}</span>
      </div>
    </div>
  );
}

function recommendationLabel(priority: PerformanceData["recommendations"][number]["priority"]) {
  if (priority === "attention") return "Vyžaduje pozornost";
  if (priority === "good") return "Vše v pořádku";
  return "Doporučujeme";
}

function recommendationClassName(priority: PerformanceData["recommendations"][number]["priority"]) {
  if (priority === "attention") return "border-red-200 bg-red-50/60";
  if (priority === "good") return "border-emerald-200 bg-emerald-50/60";
  return "border-amber-200 bg-amber-50/60";
}

function recommendationLabelClassName(priority: PerformanceData["recommendations"][number]["priority"]) {
  if (priority === "attention") return "text-red-700";
  if (priority === "good") return "text-emerald-700";
  return "text-amber-700";
}
