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
  is_active?: boolean;
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
