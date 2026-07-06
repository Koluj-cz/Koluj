# Koluj 20 – Supabase Auth sjednocení pro web i PWA

Tento patch neopouští Supabase. Používá pouze Supabase Auth:

- web: magic link přes `signInWithOtp` + serverový `/auth/callback`
- PWA: stejný e-mail, ale uživatel může opsat Supabase OTP kód a ověřit ho přes `verifyOtp`

Důvod: magic link se u PWA často otevře v běžném prohlížeči, ne v nainstalované aplikaci. Cookie se pak vytvoří mimo PWA. Zadání kódu přímo v PWA vytvoří session ve správném kontextu.

## Upraveno

- `app/login/page.tsx`
  - už nepoužívá klientský Supabase client
  - posílá požadavek na `/api/auth/otp/send`
  - umí ověřit kód přes `/api/auth/otp/verify`

- `app/api/auth/otp/send/route.ts`
  - serverově volá Supabase `signInWithOtp`

- `app/api/auth/otp/verify/route.ts`
  - serverově volá Supabase `verifyOtp`
  - nastaví SSR cookies v odpovědi

- `app/auth/callback/route.ts`
  - fallback magic link callback
  - fallback doména je `https://www.koluj.cz`

## Musíš nastavit

Vercel:

```env
NEXT_PUBLIC_APP_URL=https://www.koluj.cz
```

Supabase Auth URL Configuration:

```txt
Site URL:
https://www.koluj.cz

Redirect URLs:
https://www.koluj.cz/auth/callback
https://koluj.cz/auth/callback
http://localhost:3000/auth/callback
```

Supabase Auth email template musí obsahovat token:

```html
<p>Tvůj přihlašovací kód je:</p>
<h2>{{ .Token }}</h2>

<p>Nebo klikni na odkaz:</p>
<a href="{{ .ConfirmationURL }}">Přihlásit se</a>
```

## Co smazat / nepřidávat zpět

- `app/auth/callback/page.tsx` nesmí existovat.
- V rootu používej `proxy.ts`, ne `middleware.ts`.
- Nepřidávej klientskou kontrolu přihlášení přes `supabase.auth.getUser()` do stránek.
- `@supabase/auth-helpers-nextjs` můžeš později odstranit z `package.json`, pokud ho nikde nepoužíváš. Aktuálně se v kódu nepoužívá.

## Test

Po nasazení:
1. redeploy po změně env,
2. odinstaluj PWA,
3. smaž cookies pro `koluj.cz` i `www.koluj.cz`,
4. otevři `https://www.koluj.cz`,
5. nainstaluj PWA znovu,
6. v PWA použij přihlášení kódem.
