export const monthNames = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];

export const dayLabels = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
export const SERVICE_STEP_MINUTES = 30;

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatShortDate(value: string) {
  return parseIsoDate(value).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric",
  });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("cs-CZ", {
    hour: "2-digit", minute: "2-digit",
  });
}

export function eachDateInRange(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  let current = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);
  while (current <= end) {
    dates.push(toIsoDate(current));
    current = addDays(current, 1);
  }
  return dates;
}

export function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leadingEmptyDays = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from({ length: leadingEmptyDays }, () => null);
  for (let day = 1; day <= last.getDate(); day++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function makeLocalDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function timeFromIso(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
