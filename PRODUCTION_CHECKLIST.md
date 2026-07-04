# Koluj produkční checklist

## Povinné env proměnné

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL=https://www.koluj.cz`
- `MAPY_API_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

## Supabase Auth

V Supabase Auth nastav redirect URL:

- `https://www.koluj.cz/auth/callback`
- případně preview URL pro Vercel preview deployments

## Před deployem

- Zkontrolovat RLS policies podle `supabase-rls-checklist.sql`.
- Ověřit, že service role key není nikde v client komponentách.
- Ověřit, že bucket `offers` má povolené pouze očekávané operace.
- Ověřit, že cron endpoint posílá `Authorization: Bearer $CRON_SECRET`.
- Spustit `npm run build`.
- Spustit `npm run lint` a opravit zbylé warningy postupně.
