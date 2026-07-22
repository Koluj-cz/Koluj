export type ItemImage = {
  id: string;
  image_url: string;
  sort_order: number | null;
};

export type ItemVideo = {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number | null;
};

export type ServiceRealizationImage = {
  id: string;
  image_url: string;
  sort_order: number | null;
};

export type ServiceRealizationVideo = {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number | null;
};

export type ServiceRealization = {
  id: string;
  title: string;
  description: string | null;
  indicative_price_from: number | null;
  sort_order: number | null;
  images: ServiceRealizationImage[];
  videos: ServiceRealizationVideo[];
};

export type OfferReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

export type ItemDetail = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  offer_type?: "item" | "service" | string | null;
  category: string;
  condition: string | null;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  price_amount: number | null;
  price_unit: string | null;
  price_note: string | null;
  deposit: number | null;
  contact_note: string | null;
  handover_options: string[] | null;
  primary_image_url: string | null;
  created_at: string;
  views_count: number | null;
  service_booking_mode?: "scheduled" | "deadline" | string | null;
  service_hours_mode?: "same_every_day" | "weekday_weekend" | string | null;
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
  availability_status?: "available" | "reserved" | "unavailable";
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
    is_seed_user: boolean | null;
    profile_ratings?: { rating_avg: number | null; rating_count: number | null }[] | null;
  } | null;
};
