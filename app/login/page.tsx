"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Zadej e-mail");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setEmail(normalizedEmail);
    setSent(true);
    toast.success("Přihlašovací odkaz byl odeslán.");
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="mb-10 flex items-center justify-between">
          <BackLink href="/">Zpět na hlavní stránku</BackLink>

          <Link
            href="/"
            className="text-4xl font-black tracking-tight text-[var(--koluj-green)]"
          >
            KOLUJ
          </Link>
        </header>

        <section className="pt-12">
          <div className="koluj-card p-8 md:p-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                <Mail size={28} />
              </div>

              <div>
                <h1 className="text-4xl font-black">
                  Přihlášení
                </h1>

                <p className="mt-1 text-[var(--koluj-muted)]">
                  Jednoduše pomocí e-mailu
                </p>
              </div>
            </div>

            {!sent ? (
              <>
                <p className="mt-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
                  Zadej svůj e-mail a pošleme ti bezpečný odkaz pro
                  přihlášení. Pokud ještě účet nemáš, automaticky ho vytvoříme.
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
                        handleLogin();
                      }
                    }}
                    className="koluj-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading || !email.trim()}
                  className="koluj-button mt-8 w-full py-4 disabled:opacity-50"
                >
                  {loading ? "Odesílám odkaz..." : "Pokračovat e-mailem"}
                </button>
              </>
            ) : (
              <div className="mt-8 rounded-3xl bg-[var(--koluj-bg)] p-6">
                <h2 className="text-xl font-black text-[var(--koluj-green)]">
                  E-mail odeslán
                </h2>

                <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
                  Zkontroluj svou schránku a klikni na přihlašovací odkaz.
                </p>

                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-black">
                  {email}
                </p>

                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-5 font-bold text-[var(--koluj-green)]"
                >
                  Zadat jiný e-mail
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}