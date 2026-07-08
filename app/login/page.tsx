"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import toast from "react-hot-toast";

function safeRedirectTo(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(
    () => safeRedirectTo(searchParams.get("redirectTo")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  async function sendLoginEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Zadej e-mail");
      return;
    }

    setLoadingSend(true);

    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          redirectTo,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Přihlašovací e-mail se nepodařilo odeslat");
      }

      setEmail(normalizedEmail);
      setSent(true);
      toast.success("Přihlašovací e-mail byl odeslán.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Přihlašovací e-mail se nepodařilo odeslat");
    } finally {
      setLoadingSend(false);
    }
  }

  async function verifyLoginCode() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim().replace(/\s+/g, "");

    if (!normalizedEmail) {
      toast.error("Zadej e-mail");
      return;
    }

    if (!normalizedToken) {
      toast.error("Zadej kód z e-mailu");
      return;
    }

    setLoadingVerify(true);

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          token: normalizedToken,
          redirectTo,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Kód se nepodařilo ověřit");
      }

      window.location.replace(result?.redirectTo || "/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kód se nepodařilo ověřit");
    } finally {
      setLoadingVerify(false);
    }
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
        <header className="mb-8 flex items-center">
          <BackLink href="/">Domů</BackLink>
        </header>

        <section>
          <div className="koluj-card p-6 md:p-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                <Mail size={28} />
              </div>

              <div>
                <h1 className="text-4xl font-black">Přihlášení</h1>

                <p className="mt-1 text-[var(--koluj-muted)]">
                  Pomocí e-mailu přes Supabase
                </p>
              </div>
            </div>

            {!sent ? (
              <>
                <p className="mt-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
                  Zadej svůj e-mail a pošleme ti přihlašovací e-mail. Ve webu
                  můžeš kliknout na odkaz, v nainstalované aplikaci zadej kód.
                </p>

                <div className="mt-8">
                  <label className="mb-2 block text-sm font-bold">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        sendLoginEmail();
                      }
                    }}
                    className="koluj-input"
                    autoComplete="email"
                  />
                </div>

                <button
                  type="button"
                  onClick={sendLoginEmail}
                  disabled={loadingSend || !email.trim()}
                  className="koluj-button mt-8 w-full py-4 disabled:opacity-50"
                >
                  {loadingSend ? "Odesílám..." : "Pokračovat e-mailem"}
                </button>
              </>
            ) : (
              <div className="mt-8 rounded-3xl bg-[var(--koluj-bg)] p-6">
                <h2 className="text-xl font-black text-[var(--koluj-green)]">
                  E-mail odeslán
                </h2>

                <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
                  Ve webu můžeš kliknout na přihlašovací odkaz. V nainstalované
                  aplikaci zadej kód z e-mailu.
                </p>

                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-black">
                  {email}
                </p>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-bold">
                    Přihlašovací kód
                  </label>

                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        verifyLoginCode();
                      }
                    }}
                    placeholder="Např. 123456"
                    className="koluj-input text-center text-2xl font-black tracking-[0.3em]"
                  />
                </div>

                <button
                  type="button"
                  onClick={verifyLoginCode}
                  disabled={loadingVerify || !token.trim()}
                  className="koluj-button mt-6 w-full py-4 disabled:opacity-50"
                >
                  {loadingVerify ? "Ověřuji..." : "Přihlásit se kódem"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setToken("");
                  }}
                  className="mt-5 font-bold text-[var(--koluj-green)]"
                >
                  Poslat e-mail znovu
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
