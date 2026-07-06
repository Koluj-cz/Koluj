# Koluj 21 – dokončení přesunu logiky na server

Tento balík je celý projekt po úpravách zaměřených na bod 1: klient nemá rozhodovat auth ani zapisovat přímo do Supabase.

## Co jsem upravil

### 1. Login / Supabase Auth / PWA

Login už nepoužívá klientský Supabase browser client.

- `app/login/page.tsx`
  - klient pouze volá `/api/auth/otp/send`
  - klient pouze volá `/api/auth/otp/verify`
  - web může použít magic link
  - PWA může použít Supabase OTP kód

- `app/api/auth/otp/send/route.ts`
  - serverově volá Supabase `signInWithOtp`

- `app/api/auth/otp/verify/route.ts`
  - serverově volá Supabase `verifyOtp`
  - session cookies vznikají ve správném kontextu web/PWA

- `app/auth/callback/route.ts`
  - zůstává jako serverový callback pro magic link
  - nepoužívá se žádný klientský callback

Důležité pro Supabase e-mail šablonu:

```html
<p>Tvůj přihlašovací kód je:</p>
<h2>{{ .Token }}</h2>

<p>Nebo klikni na odkaz:</p>
<a href="{{ .ConfirmationURL }}">Přihlásit se</a>
```

### 2. Odstraněn browser Supabase klient

Smazal jsem:

```txt
lib/supabase.ts
```

V aktuálním projektu už není žádný import:

```ts
from "@/lib/supabase"
```

Tím se zabrání tomu, aby nová stránka omylem začala z klienta volat Supabase přímo.

### 3. Sjednocení API auth

U serverových API routes jsem odstranil opakované ruční vytváření SSR Supabase klienta přes cookies a sjednotil auth přes:

```ts
requireUser()
```

Upravené oblasti:

- account restore/deactivate
- bookings approve/reject/request/message/start/return
- offers archive
- availability block create/delete
- dashboard availability block create/delete

Po úpravě zůstává `supabase.auth.getUser()` jen v:

```txt
lib/supabase/middleware.ts
lib/supabase/server.ts
```

To je správně: auth se vyhodnocuje centrálně.

### 4. Moderace e-mailu

`lib/moderation.ts` už nepoužívá browser Supabase klient. Používá serverový admin client:

```ts
createSupabaseAdminClient()
```

### 5. Odstraněna duplicitní signout route

Smazal jsem:

```txt
app/auth/signout/route.ts
```

Zůstává používaná route:

```txt
app/api/auth/signout/route.ts
```

## Co ještě můžeš později smazat

V `package.json` je pořád:

```txt
@supabase/auth-helpers-nextjs
```

V kódu se už nepoužívá. Kvůli `package-lock.json` jsem ho automaticky neodstraňoval. Bezpečný postup:

```bash
npm uninstall @supabase/auth-helpers-nextjs
npm install
```

a commitnout změněný `package.json` i `package-lock.json`.

## Aktuální cílová architektura

Klient:

```txt
React komponenty
↓
fetch("/api/...")
```

Server:

```txt
Route Handler
↓
requireUser()
↓
validace dat
↓
service funkce
↓
Supabase admin / server client
↓
DB + RLS jako pojistka
```

## Důležité nastavení

Vercel:

```env
NEXT_PUBLIC_APP_URL=https://www.koluj.cz
```

Supabase Auth:

```txt
Site URL:
https://www.koluj.cz

Redirect URLs:
https://www.koluj.cz/auth/callback
https://koluj.cz/auth/callback
http://localhost:3000/auth/callback
```

## Test po nasazení

1. Redeploy po env změnách.
2. Web: přihlášení přes magic link.
3. PWA Android/iOS: přihlášení přes kód z e-mailu.
4. Zkus `/dashboard`, `/profile`, `/offers/new`.
5. Zkus vytvořit nabídku.
6. Zkus rezervaci, zprávu, schválení/odmítnutí.
7. Zkontroluj, že ve VSCode search:
   - `from "@/lib/supabase"` nemá výsledky,
   - `supabase.auth.getUser(` je jen v `lib/supabase/middleware.ts` a `lib/supabase/server.ts`.
