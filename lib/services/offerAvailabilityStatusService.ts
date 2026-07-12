import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getServiceHoursForDate, minutesFromTime } from "@/lib/serviceBookingRules";

const STEP = 30;
const APP_TIME_ZONE = "Europe/Prague";

type Offer = {
  id: string;
  offer_type?: string | null;
  service_booking_mode?: string | null;
  service_hours_mode?: string | null;
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
};

type Interval = { offer_id: string; starts_at: string | null; ends_at: string | null };
type Block = Interval & { date_from: string; date_to: string };

function nowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { today: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

function localIso(date: string, minutes: number) {
  const [y,m,d] = date.split("-").map(Number);
  return new Date(y, m-1, d, Math.floor(minutes/60), minutes%60).toISOString();
}

function overlaps(start: number, end: number, interval: Interval) {
  if (!interval.starts_at || !interval.ends_at) return false;
  return start < new Date(interval.ends_at).getTime() && end > new Date(interval.starts_at).getTime();
}

export async function attachTodayAvailabilityServer<T extends Offer>(items: T[]) {
  if (!items.length) return [];
  const supabase = createSupabaseAdminClient();
  const { today, minutes } = nowParts();
  const ids = items.map((item) => item.id);
  const dayStart = localIso(today, 0);
  const dayEnd = localIso(today, 24*60);

  const [reservations, bookings, blocks] = await Promise.all([
    supabase.from("offer_reservations").select("offer_id, starts_at, ends_at").in("offer_id", ids).eq("status", "active").lte("date_from", today).gte("date_to", today),
    supabase.from("bookings").select("offer_id, starts_at, ends_at").in("offer_id", ids).in("status", ["requested","approved","active"]).not("starts_at", "is", null).lt("starts_at", dayEnd).gt("ends_at", dayStart),
    supabase.from("offer_availability_blocks").select("offer_id, date_from, date_to, starts_at, ends_at").in("offer_id", ids).lte("date_from", today).gte("date_to", today),
  ]);
  for (const result of [reservations, bookings, blocks]) if (result.error) throw new Error(result.error.message);

  return items.map((item) => {
    const itemBlocks = (blocks.data || []).filter((row) => row.offer_id === item.id) as Block[];
    const fullDayBlocked = itemBlocks.some((block) => !block.starts_at);
    let availability_status: "available" | "reserved" | "unavailable" = "available";

    if (item.offer_type !== "service") {
      const reserved = (reservations.data || []).some((row) => row.offer_id === item.id);
      availability_status = fullDayBlocked ? "unavailable" : reserved ? "reserved" : "available";
    } else if (item.service_booking_mode === "deadline") {
      availability_status = fullDayBlocked ? "unavailable" : "available";
    } else {
      const hours = getServiceHoursForDate(item, today);
      if (!hours || fullDayBlocked) {
        availability_status = "unavailable";
      } else {
        const first = Math.max(minutesFromTime(hours.start), Math.ceil(minutes / STEP) * STEP);
        const end = minutesFromTime(hours.end);
        const intervals = [
          ...(bookings.data || []).filter((row) => row.offer_id === item.id),
          ...itemBlocks.filter((block) => block.starts_at),
        ] as Interval[];
        let free = false;
        for (let start = first; start + STEP <= end; start += STEP) {
          const a = new Date(localIso(today, start)).getTime();
          const b = new Date(localIso(today, start + STEP)).getTime();
          if (!intervals.some((interval) => overlaps(a,b,interval))) { free = true; break; }
        }
        availability_status = free ? "available" : "reserved";
      }
    }

    return {
      ...item,
      availability_status,
      is_reserved_today: availability_status === "reserved",
    };
  });
}
