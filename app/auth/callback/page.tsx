"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  useEffect(() => {
    async function handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const redirectTo = url.searchParams.get("redirectTo");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          window.location.href = "/login";
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
        },
        {
          onConflict: "id",
        }
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, city, latitude, longitude")
        .eq("id", user.id)
        .single();

      const profileComplete = Boolean(
        profile?.full_name &&
          profile?.city &&
          profile?.latitude &&
          profile?.longitude
      );

      if (redirectTo) {
        window.location.href = redirectTo;
        return;
      }

      window.location.href = profileComplete ? "/dashboard" : "/profile";
    }

    handleCallback();
  }, []);

  return (
    <main className="min-h-screen">
      <div className="koluj-shell flex min-h-screen items-center justify-center">
        <div className="koluj-card p-10 text-center">
          <h1 className="text-3xl font-black">Přihlašuji...</h1>

          <p className="mt-4 text-[var(--koluj-muted)]">
            Chvilku strpení, ověřujeme přihlášení.
          </p>
        </div>
      </div>
    </main>
  );
}