export type SearchDateRange = { dateFrom: string; dateTo: string; label: string };

function isoLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextWeekday(base: Date, weekday: number, forceNext = false) {
  const date = new Date(base);
  const delta = (weekday - date.getDay() + 7) % 7 || (forceNext ? 7 : 0);
  date.setDate(date.getDate() + delta);
  return date;
}

export function parseSearchDate(raw: string, now = new Date()): SearchDateRange | null {
  const text = raw.toLocaleLowerCase("cs-CZ").trim();
  if (!text) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bpozitri\b|\bpozítří\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 2);
    return { dateFrom: isoLocal(d), dateTo: isoLocal(d), label: "Pozítří" };
  }
  if (/\bzitra\b|\bzítra\b/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return { dateFrom: isoLocal(d), dateTo: isoLocal(d), label: "Zítra" };
  }
  if (/\bdnes\b/.test(text)) {
    return { dateFrom: isoLocal(today), dateTo: isoLocal(today), label: "Dnes" };
  }

  const nextWeekend = /příšt[ií]\s+víkend|pristi\s+vikend/.test(text);
  if (/\bvíkend\b|\bvikend\b/.test(text)) {
    const saturday = nextWeekday(today, 6, nextWeekend || today.getDay() === 0 || today.getDay() === 6);
    const sunday = new Date(saturday); sunday.setDate(sunday.getDate() + 1);
    return { dateFrom: isoLocal(saturday), dateTo: isoLocal(sunday), label: nextWeekend ? "Příští víkend" : "Tento víkend" };
  }

  const range = text.match(/\b(\d{1,2})\s*[.\/]\s*(\d{1,2})(?:\s*[.\/]\s*(\d{2,4}))?\s*(?:-|–|až|az|do)\s*(\d{1,2})\s*[.\/]\s*(\d{1,2})(?:\s*[.\/]\s*(\d{2,4}))?/);
  if (range) {
    const year1 = range[3] ? Number(range[3].length === 2 ? `20${range[3]}` : range[3]) : today.getFullYear();
    const year2 = range[6] ? Number(range[6].length === 2 ? `20${range[6]}` : range[6]) : year1;
    const from = new Date(year1, Number(range[2]) - 1, Number(range[1]));
    const to = new Date(year2, Number(range[5]) - 1, Number(range[4]));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from) {
      return { dateFrom: isoLocal(from), dateTo: isoLocal(to), label: `${range[1]}. ${range[2]}. – ${range[4]}. ${range[5]}.` };
    }
  }

  const single = text.match(/\b(\d{1,2})\s*[.\/]\s*(\d{1,2})(?:\s*[.\/]\s*(\d{2,4}))?\.?/);
  if (single) {
    let year = single[3] ? Number(single[3].length === 2 ? `20${single[3]}` : single[3]) : today.getFullYear();
    let date = new Date(year, Number(single[2]) - 1, Number(single[1]));
    if (!single[3] && date < today) date = new Date(year + 1, Number(single[2]) - 1, Number(single[1]));
    if (!Number.isNaN(date.getTime())) {
      return { dateFrom: isoLocal(date), dateTo: isoLocal(date), label: `${single[1]}. ${single[2]}. ${date.getFullYear()}` };
    }
  }
  return null;
}

export function stripSearchDate(raw: string) {
  return raw
    .replace(/\b(?:dnes|zítra|zitra|pozítří|pozitri|tento\s+víkend|tento\s+vikend|příští\s+víkend|pristi\s+vikend|o\s+víkendu|o\s+vikendu|na\s+víkend|na\s+vikend)\b/gi, " ")
    .replace(/\b\d{1,2}\s*[.\/]\s*\d{1,2}(?:\s*[.\/]\s*\d{2,4})?\.?\s*(?:(?:-|–|až|az|do)\s*\d{1,2}\s*[.\/]\s*\d{1,2}(?:\s*[.\/]\s*\d{2,4})?\.?)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
