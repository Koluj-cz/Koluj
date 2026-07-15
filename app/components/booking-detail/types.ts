export type Booking = {
  id: string;
  owner_id: string | null;
  customer_id: string | null;
  status: string;
  created_at: string;
  date_from?: string | null;
  date_to?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  total_price?: number | null;
  approved_at?: string | null;
  returned_at?: string | null;
  handed_over_at?: string | null;
  reviewed?: boolean;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  customer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  offers: {
    id: string; title: string; primary_image_url: string | null; pickup_place: string;
    price_amount: number | null; price_unit: string | null; deposit: number | null;
    offer_type: string | null; service_booking_mode?: string | null;
  } | null;
};

export type Message = {
  id: string;
  message: string;
  sender_id: string | null;
  is_system: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
};
