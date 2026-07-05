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
          window.location.replace("/login");
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const profileResponse = await fetch("/api/auth/ensure-profile", {
        method: "POST",
      });

      const profileResult = await profileResponse.json().catch(() => null);
      const profileComplete = Boolean(profileResponse.ok && profileResult?.profileComplete);

      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        window.location.replace(redirectTo);
        return;
      }

      window.location.replace(profileComplete ? "/dashboard" : "/profile");
    }

    handleCallback();
  }, []);

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame flex min-h-screen items-center justify-center">
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