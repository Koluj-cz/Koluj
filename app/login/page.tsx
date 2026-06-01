"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("Přihlašovací odkaz byl odeslán.");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f8f8f5] px-6">
      <div className="absolute left-6 top-6">
        <Link href="/" className="text-sm text-gray-600 hover:text-black">
          ← Zpět na hlavní stránku
        </Link>
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Přihlášení</h1>

        <p className="mt-3 text-gray-600">
          Zadej e-mail a pošleme ti odkaz pro přihlášení.
        </p>

        {sent ? (
          <div className="mt-6 rounded-2xl bg-green-50 p-4 text-green-800">
            Hotovo. Zkontroluj e-mail a klikni na přihlašovací odkaz.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="tvuj@email.cz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />

            <button
              onClick={handleLogin}
              disabled={loading || !email}
              className="w-full rounded-xl bg-black py-3 text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Odesílám..." : "Pokračovat e-mailem"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}