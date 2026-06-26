export function translatePriceUnit(unit: string | null) {
  if (unit === "hour") return "hodinu";
  if (unit === "day") return "den";
  if (unit === "weekend") return "víkend";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";
  if (unit === "piece") return "půjčení";
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

import { loanStatusLabels } from "./constants";

export function translateLoanStatus(status: string | null) {
  return status ? loanStatusLabels[status as keyof typeof loanStatusLabels] ?? status : "";
}