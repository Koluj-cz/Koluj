export type ServiceBookingMode = "scheduled" | "deadline";
export type ServiceHoursMode = "same_every_day" | "weekday_weekend";

export type ServiceHoursSource = {
  service_booking_mode?: ServiceBookingMode | string | null;
  service_hours_mode?: ServiceHoursMode | string | null;
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
};

export function minutesFromTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function getServiceHoursForDate(source: ServiceHoursSource, date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  const weekend = day === 0 || day === 6;
  const start = weekend ? source.weekend_start_time : source.weekday_start_time;
  const end = weekend ? source.weekend_end_time : source.weekday_end_time;

  if (!start || !end || minutesFromTime(end) <= minutesFromTime(start)) {
    return null;
  }

  return { start: start.slice(0, 5), end: end.slice(0, 5) };
}

export function buildTimeOptions(start: string, end: string, stepMinutes = 30) {
  const options: string[] = [];
  for (let value = minutesFromTime(start); value <= minutesFromTime(end); value += stepMinutes) {
    options.push(timeFromMinutes(value));
  }
  return options;
}

export function getZonedDateTimeParts(value: string | Date, timeZone = "Europe/Prague") {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isServiceIntervalInsideOpeningHours(
  source: ServiceHoursSource,
  startsAt: string,
  endsAt: string,
) {
  const start = getZonedDateTimeParts(startsAt);
  const end = getZonedDateTimeParts(endsAt);
  if (start.date !== end.date) return false;
  const hours = getServiceHoursForDate(source, start.date);
  if (!hours) return false;
  return (
    minutesFromTime(start.time) >= minutesFromTime(hours.start) &&
    minutesFromTime(end.time) <= minutesFromTime(hours.end)
  );
}
