"use client";

import { useState } from "react";
import {
  Award,
  CalendarDays,
  Check,
  CircleHelp,
  MailCheck,
  Phone,
  ShieldCheck,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import type { UserTrustSummary } from "@/lib/services/userTrustService";
import UserTrustBadge from "./UserTrustBadge";

export default function UserTrustCard({
  trust,
  embedded = false,
  compactDetails = false,
}: {
  trust: UserTrustSummary;
  embedded?: boolean;
  compactDetails?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className={embedded ? "p-0" : "koluj-card p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <ShieldCheck size={22} className="text-[var(--koluj-green)]" />
              Důvěryhodnost
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--koluj-muted)]">
              Informace vycházejí z ověření účtu, aktivity, rezervací a hodnocení na Koluj.
            </p>
          </div>
          <UserTrustBadge level={trust.level} />
        </div>

        <div className="mt-5 grid gap-3 text-sm">
          <TrustLine icon={<MailCheck size={18} />} ok={trust.emailVerified} text="Ověřený e-mail" />
          <TrustLine icon={<Phone size={18} />} ok={trust.phoneProvided} text={trust.phoneProvided ? "Telefon uveden" : "Telefon neuveden"} />
          {!compactDetails && (
            <>
              <TrustLine icon={<Trophy size={18} />} ok={trust.completedBookings > 0} text={`${trust.completedBookings} dokončených rezervací`} />
              <TrustLine icon={<Star size={18} />} ok={trust.ratingCount > 0} text={trust.ratingCount > 0 ? `Hodnocení ${trust.ratingAverage.toFixed(1)} (${trust.ratingCount})` : "Zatím bez hodnocení"} />
              <TrustLine icon={<CalendarDays size={18} />} ok text={`Na Koluj od ${formatDate(trust.joinedAt)}`} />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[var(--koluj-green)] hover:underline"
        >
          <CircleHelp size={17} />
          Jak získat vyšší úroveň?
        </button>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/65 px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-4 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Jak získat vyšší úroveň důvěryhodnosti"
        >
          <div className="max-h-[calc(100dvh-120px-env(safe-area-inset-bottom))] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:max-h-[90dvh] md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Úrovně důvěryhodnosti</h2>
                <p className="mt-2 text-[var(--koluj-muted)]">
                  Odznaky se přidělují automaticky podle jasných pravidel. Běžný účet žádný odznak nepotřebuje.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-[var(--koluj-bg)]" aria-label="Zavřít">
                <X size={22} />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <LevelInfo
                icon={<ShieldCheck size={20} />}
                title="Důvěryhodný poskytovatel"
                className="border-blue-200 bg-blue-50"
                items={[
                  "Ověřený e-mail",
                  "Uvedený telefon",
                  "Alespoň 5 dokončených rezervací",
                  "Alespoň 3 hodnocení",
                  "Průměrné hodnocení 4,5 nebo vyšší",
                ]}
              />
              <LevelInfo
                icon={<Award size={20} />}
                title="Top poskytovatel"
                className="border-violet-200 bg-violet-50"
                items={[
                  "Ověřený e-mail a uvedený telefon",
                  "Alespoň 25 dokončených rezervací",
                  "Alespoň 10 hodnocení",
                  "Průměrné hodnocení 4,8 nebo vyšší",
                ]}
              />
            </div>

            {trust.level !== "top" && (
              <div className="mt-6 rounded-2xl bg-[var(--koluj-bg)] p-5">
                <h3 className="font-black">Další krok k odznaku</h3>
                <MissingRequirements trust={trust} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TrustLine({ icon, ok, text }: { icon: React.ReactNode; ok: boolean; text: string }) {
  return (
    <p className="flex items-center gap-3 text-[var(--koluj-muted)]">
      <span className={ok ? "text-[var(--koluj-green)]" : "text-gray-400"}>{icon}</span>
      <span className="font-bold">{text}</span>
    </p>
  );
}

function LevelInfo({ icon, title, items, className }: { icon: React.ReactNode; title: string; items: string[]; className: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`}>
      <h3 className="flex items-center gap-2 font-black">{icon}{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-[var(--koluj-muted)]">
        {items.map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0" />{item}</li>)}
      </ul>
    </div>
  );
}

function MissingRequirements({ trust }: { trust: UserTrustSummary }) {
  const target = trust.level === "trusted" ? trust.progress.top : trust.progress.trusted;
  const items: string[] = [];
  if (target.missingPhone) items.push("Doplnit telefon do profilu");
  if (target.missingCompletedBookings > 0) items.push(`Dokončit ještě ${target.missingCompletedBookings} rezervací`);
  if (target.missingRatings > 0) items.push(`Získat ještě ${target.missingRatings} hodnocení`);
  if (target.missingRatingAverage > 0) items.push(`Zvýšit průměrné hodnocení o ${target.missingRatingAverage.toFixed(1)}`);
  if (!items.length) items.push("Podmínky jsou splněné. Úroveň se aktualizuje automaticky.");
  return <ul className="mt-3 space-y-2 text-sm font-bold text-[var(--koluj-muted)]">{items.map((item) => <li key={item}>• {item}</li>)}</ul>;
}
