-- KOLUJ 2.0 naming cleanup: offers/bookings terminology.
-- Run after backing up the database. This migration is intended for the current pre-production schema.

-- offer_images: item_id -> offer_id
alter table if exists public.offer_images
  rename column item_id to offer_id;

alter table if exists public.offer_images
  rename constraint item_images_item_id_fkey to offer_images_offer_id_fkey;

-- bookings: item_id -> offer_id, borrower_id -> customer_id
alter table if exists public.bookings
  rename column item_id to offer_id;

alter table if exists public.bookings
  rename column borrower_id to customer_id;

alter table if exists public.bookings
  rename constraint loans_item_id_fkey to bookings_offer_id_fkey;

alter table if exists public.bookings
  rename constraint loans_owner_id_fkey to bookings_owner_id_fkey;

alter table if exists public.bookings
  rename constraint loans_borrower_id_fkey to bookings_customer_id_fkey;

-- booking_messages: loan_id -> booking_id
alter table if exists public.booking_messages
  rename column loan_id to booking_id;

alter table if exists public.booking_messages
  rename constraint loan_messages_loan_id_fkey to booking_messages_booking_id_fkey;

alter table if exists public.booking_messages
  rename constraint loan_messages_sender_id_fkey to booking_messages_sender_id_fkey;

-- notifications: loan_id -> booking_id, item_id -> offer_id
alter table if exists public.notifications
  rename column loan_id to booking_id;

alter table if exists public.notifications
  rename column item_id to offer_id;

alter table if exists public.notifications
  rename constraint notifications_loan_id_fkey to notifications_booking_id_fkey;

alter table if exists public.notifications
  rename constraint notifications_item_id_fkey to notifications_offer_id_fkey;

-- booking_participant_presence: loan_id -> booking_id
alter table if exists public.booking_participant_presence
  rename column loan_id to booking_id;

alter table if exists public.booking_participant_presence
  rename constraint loan_participant_presence_loan_id_fkey to booking_participant_presence_booking_id_fkey;

alter table if exists public.booking_participant_presence
  rename constraint loan_participant_presence_user_id_fkey to booking_participant_presence_user_id_fkey;

-- offer_availability_watchers: item_id -> offer_id
alter table if exists public.offer_availability_watchers
  rename column item_id to offer_id;

alter table if exists public.offer_availability_watchers
  rename constraint item_availability_watchers_item_id_fkey to offer_availability_watchers_offer_id_fkey;

alter table if exists public.offer_availability_watchers
  rename constraint item_availability_watchers_user_id_fkey to offer_availability_watchers_user_id_fkey;

-- offer_reservations: item_id -> offer_id, loan_id -> booking_id
alter table if exists public.offer_reservations
  rename column item_id to offer_id;

alter table if exists public.offer_reservations
  rename column loan_id to booking_id;

alter table if exists public.offer_reservations
  rename constraint item_reservations_item_id_fkey to offer_reservations_offer_id_fkey;

alter table if exists public.offer_reservations
  rename constraint item_reservations_loan_id_fkey to offer_reservations_booking_id_fkey;

-- offer_availability_blocks: item_id -> offer_id
alter table if exists public.offer_availability_blocks
  rename column item_id to offer_id;

alter table if exists public.offer_availability_blocks
  rename constraint item_availability_blocks_item_id_fkey to offer_availability_blocks_offer_id_fkey;

alter table if exists public.offer_availability_blocks
  rename constraint item_availability_blocks_owner_id_fkey to offer_availability_blocks_owner_id_fkey;

-- booking_reminders: loan_id -> booking_id
alter table if exists public.booking_reminders
  rename column loan_id to booking_id;

alter table if exists public.booking_reminders
  rename constraint loan_reminders_loan_id_fkey to booking_reminders_booking_id_fkey;

-- reviews: item_id -> offer_id, loan_id -> booking_id
alter table if exists public.reviews
  rename column item_id to offer_id;

alter table if exists public.reviews
  rename column loan_id to booking_id;

alter table if exists public.reviews
  rename constraint reviews_item_id_fkey to reviews_offer_id_fkey;

alter table if exists public.reviews
  rename constraint reviews_loan_id_fkey to reviews_booking_id_fkey;

-- offers owner FK constraint name cleanup
alter table if exists public.offers
  rename constraint items_owner_id_fkey to offers_owner_id_fkey;

-- Increment views function with offer naming.
create or replace function public.increment_offer_views(offer_id_input uuid)
returns void
language sql
security definer
as $$
  update public.offers
  set views_count = coalesce(views_count, 0) + 1
  where id = offer_id_input;
$$;

-- Helpful indexes after rename.
create index if not exists idx_offer_images_offer_id on public.offer_images(offer_id);
create index if not exists idx_bookings_offer_id on public.bookings(offer_id);
create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_booking_messages_booking_id on public.booking_messages(booking_id);
create index if not exists idx_notifications_booking_id on public.notifications(booking_id);
create index if not exists idx_notifications_offer_id on public.notifications(offer_id);
create index if not exists idx_offer_reservations_offer_id on public.offer_reservations(offer_id);
create index if not exists idx_offer_reservations_booking_id on public.offer_reservations(booking_id);
create index if not exists idx_offer_availability_blocks_offer_id on public.offer_availability_blocks(offer_id);
create index if not exists idx_booking_reminders_booking_id on public.booking_reminders(booking_id);
