-- KOLUJ 2.0: věci + služby jako nabídky.
-- Spouštěj až po záloze databáze. Migrace přejmenuje hlavní tabulky,
-- přidá typ nabídky a připraví rezervace služeb na časové bloky.

alter table if exists public.items rename to offers;
alter table if exists public.item_images rename to offer_images;
alter table if exists public.item_reservations rename to offer_reservations;
alter table if exists public.item_availability_blocks rename to offer_availability_blocks;
alter table if exists public.item_availability_watchers rename to offer_availability_watchers;

alter table if exists public.loans rename to bookings;
alter table if exists public.loan_messages rename to booking_messages;
alter table if exists public.loan_reminders rename to booking_reminders;
alter table if exists public.loan_participant_presence rename to booking_participant_presence;

alter table public.offers
  add column if not exists offer_type text not null default 'item'
    check (offer_type in ('item', 'service')),
  add column if not exists service_duration_minutes integer,
  add column if not exists service_location_type text
    check (service_location_type is null or service_location_type in ('in_person', 'online', 'both'));

alter table public.bookings
  add column if not exists starts_at timestamp with time zone,
  add column if not exists ends_at timestamp with time zone;

create index if not exists idx_offers_offer_type on public.offers(offer_type);
create index if not exists idx_offers_owner_type on public.offers(owner_id, offer_type);
create index if not exists idx_bookings_item_dates on public.bookings(item_id, date_from, date_to);
create index if not exists idx_bookings_item_time on public.bookings(item_id, starts_at, ends_at);
create index if not exists idx_offer_reservations_item_dates on public.offer_reservations(item_id, date_from, date_to);
create index if not exists idx_offer_blocks_item_dates on public.offer_availability_blocks(item_id, date_from, date_to);

-- Názvy sloupců item_id/loan_id zůstávají zatím zachované kvůli bezpečné migraci kódu.
-- V další fázi je možné je přejmenovat na offer_id/booking_id.
