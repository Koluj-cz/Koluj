"use client";

import { CalendarClock, Clock3 } from "lucide-react";
import SectionTitle from "@/app/components/SectionTitle";
import type { OfferFormState } from "@/app/components/offer-form/types";

type Props = {
  form: OfferFormState;
  setForm: React.Dispatch<React.SetStateAction<OfferFormState>>;
};

function TimeRange({
  label,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  label: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-5">
      <p className="font-black">{label}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Od
          <input
            type="time"
            step={1800}
            value={start}
            onChange={(event) => onStartChange(event.target.value)}
            className="koluj-input mt-2"
          />
        </label>
        <label className="text-sm font-bold">
          Do
          <input
            type="time"
            step={1800}
            value={end}
            onChange={(event) => onEndChange(event.target.value)}
            className="koluj-input mt-2"
          />
        </label>
      </div>
    </div>
  );
}

export default function ServiceBookingSettingsSection({ form, setForm }: Props) {
  if (form.offer_type !== "service") return null;

  function setSameDayTime(field: "start" | "end", value: string) {
    setForm((current) => ({
      ...current,
      ...(field === "start"
        ? { weekday_start_time: value, weekend_start_time: value }
        : { weekday_end_time: value, weekend_end_time: value }),
    }));
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<CalendarClock size={24} />} title="Jak se služba objednává?" />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setForm((current) => ({ ...current, service_booking_mode: "scheduled" }))}
          className={`rounded-3xl px-5 py-4 text-left font-black ${
            form.service_booking_mode === "scheduled"
              ? "bg-[var(--koluj-green)] text-white"
              : "bg-[var(--koluj-bg)]"
          }`}
        >
          Konkrétní datum a čas
          <span className="mt-1 block text-sm font-bold opacity-80">
            Zákazník vybere volný čas v kalendáři.
          </span>
        </button>

        <button
          type="button"
          onClick={() => setForm((current) => ({ ...current, service_booking_mode: "deadline" }))}
          className={`rounded-3xl px-5 py-4 text-left font-black ${
            form.service_booking_mode === "deadline"
              ? "bg-[var(--koluj-green)] text-white"
              : "bg-[var(--koluj-bg)]"
          }`}
        >
          Flexibilně – termín dokončení
          <span className="mt-1 block text-sm font-bold opacity-80">
            Zákazník určí pouze den, do kterého má být práce hotová.
          </span>
        </button>
      </div>

      {form.service_booking_mode === "deadline" ? (
        <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] p-5 text-[var(--koluj-muted)]">
          Konkrétní čas provedení si domluvíte v chatu. Zákazník při rezervaci vybere jen požadovaný termín dokončení.
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-center gap-3">
            <Clock3 size={20} className="text-[var(--koluj-green)]" />
            <h3 className="text-xl font-black">Provozní doba služby</h3>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["same_every_day", "Stejná každý den"],
              ["weekday_weekend", "Pracovní dny a víkend zvlášť"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    service_hours_mode: value as OfferFormState["service_hours_mode"],
                    ...(value === "same_every_day"
                      ? {
                          weekend_start_time: current.weekday_start_time,
                          weekend_end_time: current.weekday_end_time,
                        }
                      : {}),
                  }))
                }
                className={`rounded-2xl px-4 py-3 font-black ${
                  form.service_hours_mode === value
                    ? "bg-[var(--koluj-green)] text-white"
                    : "bg-[var(--koluj-bg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {form.service_hours_mode === "same_every_day" ? (
              <TimeRange
                label="Každý den"
                start={form.weekday_start_time}
                end={form.weekday_end_time}
                onStartChange={(value) => setSameDayTime("start", value)}
                onEndChange={(value) => setSameDayTime("end", value)}
              />
            ) : (
              <>
                <TimeRange
                  label="Pracovní dny (pondělí–pátek)"
                  start={form.weekday_start_time}
                  end={form.weekday_end_time}
                  onStartChange={(value) => setForm((current) => ({ ...current, weekday_start_time: value }))}
                  onEndChange={(value) => setForm((current) => ({ ...current, weekday_end_time: value }))}
                />
                <TimeRange
                  label="Víkend (sobota–neděle)"
                  start={form.weekend_start_time}
                  end={form.weekend_end_time}
                  onStartChange={(value) => setForm((current) => ({ ...current, weekend_start_time: value }))}
                  onEndChange={(value) => setForm((current) => ({ ...current, weekend_end_time: value }))}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
