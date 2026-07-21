export type Reservation = {
  id: string;
  booking_id: string;
  date_from: string;
  date_to: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
};

export type Block = {
  id: string;
  date_from: string;
  date_to: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
};

export type SelectedRange = {
  dateFrom: string;
  dateTo: string;
};

export type SelectedSlot = {
  startsAt: string;
  endsAt: string;
};

export type AvailabilityCalendarProps = {
  offerId: string;
  offerType?: string | null;
  isOwner?: boolean;
  selectedRange?: SelectedRange | null;
  selectedSlot?: SelectedSlot | null;
  onRangeChange?: (range: SelectedRange | null) => void;
  onSlotChange?: (slot: SelectedSlot | null) => void;
  serviceBookingMode?: "scheduled" | "deadline" | string | null;
  serviceHoursMode?: "same_every_day" | "weekday_weekend" | string | null;
  weekdayStartTime?: string | null;
  weekdayEndTime?: string | null;
  weekendStartTime?: string | null;
  weekendEndTime?: string | null;
  showDeadlineSelectionSummary?: boolean;
};
