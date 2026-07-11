import { bookingStatusLabels } from "./constants";

export function translatePriceUnit(
  unit: string | null,
  offerType?: string | null
) {
  if (unit === "hour") return "hodinu";
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
  return new Date(date).toLocaleDateString("cs-CZ");
}

export function formatDateTime(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
};

export function getBookingDisplayStatus({
  status,
  offerType,
  startsAt,
  endsAt,
}: BookingStatusSource): {
  key: BookingDisplayStatusKey;
  label: string;
} {
  if (offerType !== "service") {
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

  if (displayStatus.key === "scheduled") return "approved";
  if (
    displayStatus.key === "in_progress" ||
    displayStatus.key === "awaiting_completion"
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
