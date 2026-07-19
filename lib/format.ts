import { bookingStatusLabels } from "./constants";

const APP_TIME_ZONE = "Europe/Prague";

export function translatePriceUnit(
  unit: string | null,
  offerType?: string | null
) {
  if (unit === "hour") return "hodinu";
  if (unit === "individual") return "individuálně";
  if (unit === "day") return "den";
  if (unit === "weekend") return "víkend";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";

  if (unit === "piece") {
    return offerType === "service" ? "zakázku" : "půjčení";
  }

  return "";
}

export function formatDate(date: string | null) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatDateTime(date: string | null) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDateRange(dateFrom: string | null, dateTo: string | null) {
  if (!dateFrom && !dateTo) return "";
  if (!dateTo || dateFrom === dateTo) return formatDate(dateFrom || dateTo);
  return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
}

export function translateBookingStatus(status: string | null) {
  return status
    ? bookingStatusLabels[status as keyof typeof bookingStatusLabels] ?? status
    : "";
}



export type BookingDisplayStatusKey =
  | "requested"
  | "scheduled"
  | "in_progress"
  | "awaiting_completion"
  | "waiting_pickup"
  | "waiting_return"
  | "completed"
  | "approved"
  | "active"
  | "returned"
  | "cancelled";

export type BookingStatusSource = {
  status: string | null;
  offerType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export function getBookingDisplayStatus({
  status,
  offerType,
  startsAt,
  endsAt,
  dateFrom,
  dateTo,
}: BookingStatusSource): {
  key: BookingDisplayStatusKey;
  label: string;
} {
  if (offerType !== "service") {
    if (status === "requested") {
      return { key: "requested", label: "Čeká na schválení" };
    }

    if (status === "cancelled") {
      return { key: "cancelled", label: "Zrušeno" };
    }

    if (status === "returned") {
      return { key: "returned", label: "Vráceno" };
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (status === "approved") {
      if (dateFrom && today < dateFrom) {
        return { key: "scheduled", label: "Naplánováno" };
      }

      return { key: "waiting_pickup", label: "Čeká na předání" };
    }

    if (status === "active") {
      if (dateTo && today > dateTo) {
        return { key: "waiting_return", label: "Čeká na vrácení" };
      }

      return { key: "in_progress", label: "Probíhá" };
    }

    return {
      key: (status || "requested") as BookingDisplayStatusKey,
      label: translateBookingStatus(status),
    };
  }

  if (status === "requested") {
    return { key: "requested", label: "Čeká na schválení" };
  }

  if (status === "cancelled") {
    return { key: "cancelled", label: "Zrušeno" };
  }

  if (status === "returned") {
    return { key: "completed", label: "Dokončeno" };
  }

  if (status === "approved" || status === "active") {
    if (!startsAt || !endsAt) {
      return { key: "scheduled", label: "Naplánováno" };
    }

    const now = Date.now();
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return { key: "scheduled", label: "Naplánováno" };
    }

    if (now < start) {
      return { key: "scheduled", label: "Naplánováno" };
    }

    if (now < end) {
      return { key: "in_progress", label: "Probíhá" };
    }

    return {
      key: "awaiting_completion",
      label: "Čeká na dokončení",
    };
  }

  return {
    key: (status || "requested") as BookingDisplayStatusKey,
    label: translateBookingStatus(status),
  };
}

export function getBookingFilterStatus(
  booking: BookingStatusSource,
): "requested" | "approved" | "active" | "returned" | "cancelled" {
  const displayStatus = getBookingDisplayStatus(booking);

  if (
    displayStatus.key === "scheduled" ||
    displayStatus.key === "waiting_pickup"
  ) return "approved";
  if (
    displayStatus.key === "in_progress" ||
    displayStatus.key === "awaiting_completion" ||
    displayStatus.key === "waiting_return"
  ) {
    return "active";
  }
  if (displayStatus.key === "completed") return "returned";

  if (
    displayStatus.key === "requested" ||
    displayStatus.key === "approved" ||
    displayStatus.key === "active" ||
    displayStatus.key === "returned" ||
    displayStatus.key === "cancelled"
  ) {
    return displayStatus.key;
  }

  return "requested";
}
