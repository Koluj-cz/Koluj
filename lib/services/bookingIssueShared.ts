export const BOOKING_ISSUE_TYPES = [
  "provider_no_show",
  "customer_no_show",
  "damaged_item",
  "not_returned",
  "not_as_described",
  "inappropriate_behavior",
  "other",
] as const;

export type BookingIssueType = (typeof BOOKING_ISSUE_TYPES)[number];
export type BookingIssueStatus = "new" | "in_progress" | "resolved";

export const BOOKING_ISSUE_LABELS: Record<BookingIssueType, string> = {
  provider_no_show: "Poskytovatel nepřišel",
  customer_no_show: "Zájemce nepřišel",
  damaged_item: "Věc byla poškozena",
  not_returned: "Věc nebyla vrácena",
  not_as_described: "Nabídka neodpovídala popisu",
  inappropriate_behavior: "Nevhodné chování",
  other: "Jiný problém",
};

export const BOOKING_ISSUE_STATUS_LABELS: Record<BookingIssueStatus, string> = {
  new: "Nový",
  in_progress: "Řeší se",
  resolved: "Vyřešen",
};

export function isBookingIssueType(value: string): value is BookingIssueType {
  return BOOKING_ISSUE_TYPES.includes(value as BookingIssueType);
}

export function isBookingIssueStatus(value: string): value is BookingIssueStatus {
  return value === "new" || value === "in_progress" || value === "resolved";
}
