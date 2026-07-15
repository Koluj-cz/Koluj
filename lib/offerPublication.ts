export const OFFER_PUBLICATION_STATUSES = [
  "active",
  "inactive",
  "archived",
] as const;

export type OfferPublicationStatus =
  (typeof OFFER_PUBLICATION_STATUSES)[number];

export function normalizeEditablePublicationStatus(
  value: unknown,
): Exclude<OfferPublicationStatus, "archived"> {
  return value === "inactive" ? "inactive" : "active";
}

export function isPublicPublicationStatus(value: unknown) {
  return value === "active";
}
