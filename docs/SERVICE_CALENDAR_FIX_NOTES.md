# Service calendar fix

This package keeps the hourly service calendar from the previous patch and fixes the missing `normalizeDateRange` export used by the central dashboard availability block API.

Checked locally:

- `npx tsc --noEmit` passed.
- `npm run build` only failed because the sandbox cannot fetch Google Fonts for `next/font`; no TypeScript error was reported before that font fetch failure.

Important database expectation:

- `offer_reservations` has `starts_at` and `ends_at` columns.
- `offer_availability_blocks` has `starts_at` and `ends_at` columns.
- `bookings` has `starts_at` and `ends_at` columns.
