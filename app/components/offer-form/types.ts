export type OfferFormState = {
  offer_type: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price_amount: string;
  price_unit: string;
  price_note: string;
  deposit: string;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  handover_options: string[];
  contact_note: string;
  service_booking_mode: "scheduled" | "deadline";
  service_hours_mode: "same_every_day" | "weekday_weekend";
  weekday_start_time: string;
  weekday_end_time: string;
  weekend_start_time: string;
  weekend_end_time: string;
  publication_status?: "active" | "inactive";
};

export type ExistingOfferPhoto = {
  id: string;
  image_url: string;
  sort_order?: number | null;
};

export type PlaceSuggestion = {
  name: string;
  label?: string;
  location?: string;
  position: { lat: number; lon: number };
};

export type OfferFormMode = "new" | "edit";

export type ExistingOfferVideo = {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order?: number | null;
};
