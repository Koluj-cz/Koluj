"use client";

import {
  CalendarDays,
  MailCheck,
  Phone,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import HelpTopic, { type HelpItem } from "@/app/components/help/HelpTopic";
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
  const helpItems = createTrustHelpItems(trust);

  return (
    <section className={embedded ? "p-0" : "koluj-card p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
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
        <TrustLine
          icon={<MailCheck size={18} />}
          ok={trust.emailVerified}
          text="Ověřený e-mail"
        />
        <TrustLine
          icon={<Phone size={18} />}
          ok={trust.phoneProvided}
          text={trust.phoneProvided ? "Telefon uveden" : "Telefon neuveden"}
        />
        {!compactDetails && (
          <>
            <TrustLine
              icon={<Trophy size={18} />}
              ok={trust.completedBookings > 0}
              text={`${trust.completedBookings} dokončených rezervací`}
            />
            <TrustLine
              icon={<Star size={18} />}
              ok={trust.ratingCount > 0}
              text={
                trust.ratingCount > 0
                  ? `Hodnocení ${trust.ratingAverage.toFixed(1)} (${trust.ratingCount})`
                  : "Zatím bez hodnocení"
              }
            />
            <TrustLine
              icon={<CalendarDays size={18} />}
              ok
              text={`Na Koluj od ${formatDate(trust.joinedAt)}`}
            />
          </>
        )}
      </div>

      <div className="mt-4">
        <HelpTopic
          title="Úrovně důvěryhodnosti"
          triggerLabel="Jak získat vyšší úroveň?"
          items={helpItems}
          className="-ml-2"
        />
      </div>
    </section>
  );
}

function createTrustHelpItems(trust: UserTrustSummary): HelpItem[] {
  const items: HelpItem[] = [
    {
      title: "Jak odznaky fungují",
      description:
        "Odznaky se přidělují automaticky podle jasných pravidel. Běžný účet žádný odznak nepotřebuje.",
    },
    {
      title: "Důvěryhodný poskytovatel",
      description:
        "Ověřený e-mail, uvedený telefon, alespoň 5 dokončených rezervací, alespoň 3 hodnocení a průměrné hodnocení 4,5 nebo vyšší.",
    },
    {
      title: "Top poskytovatel",
      description:
        "Ověřený e-mail, uvedený telefon, alespoň 25 dokončených rezervací, alespoň 10 hodnocení a průměrné hodnocení 4,8 nebo vyšší.",
    },
  ];

  if (trust.level !== "top") {
    items.push({
      title: "Další krok k odznaku",
      description: getMissingRequirementsText(trust),
    });
  }

  return items;
}

function getMissingRequirementsText(trust: UserTrustSummary) {
  const target =
    trust.level === "trusted" ? trust.progress.top : trust.progress.trusted;
  const missing: string[] = [];

  if (target.missingPhone) missing.push("doplnit telefon do profilu");
  if (target.missingCompletedBookings > 0) {
    missing.push(`dokončit ještě ${target.missingCompletedBookings} rezervací`);
  }
  if (target.missingRatings > 0) {
    missing.push(`získat ještě ${target.missingRatings} hodnocení`);
  }
  if (target.missingRatingAverage > 0) {
    missing.push(
      `zvýšit průměrné hodnocení o ${target.missingRatingAverage.toFixed(1)}`,
    );
  }

  if (missing.length === 0) {
    return "Podmínky jsou splněné. Úroveň se aktualizuje automaticky.";
  }

  return `Je potřeba ${missing.join(", ")}.`;
}

function TrustLine({
  icon,
  ok,
  text,
}: {
  icon: React.ReactNode;
  ok: boolean;
  text: string;
}) {
  return (
    <p className="flex items-center gap-3 text-[var(--koluj-muted)]">
      <span className={ok ? "text-[var(--koluj-green)]" : "text-gray-400"}>
        {icon}
      </span>
      <span className="font-bold">{text}</span>
    </p>
  );
}
