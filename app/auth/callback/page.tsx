"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [debug, setDebug] = useState("Přihlašuji...");

  useEffect(() => {
    async function handleCallback() {
      setDebug(`URL: ${window.location.href}`);

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setDebug(`Chyba exchangeCodeForSession: ${error.message}`);
          return;
        }
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setDebug(`Chyba getUser: ${userError.message}`);
        return;
      }

      if (!user) {
        setDebug("Uživatel nenalezen. Session se nevytvořila.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        setDebug(`Chyba vytvoření profilu: ${profileError.message}`);
        return;
      }

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

      router.replace(profileComplete ? "/dashboard" : "/profile");
    }

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5] px-6">
      <div className="max-w-xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="whitespace-pre-wrap text-sm">{debug}</p>
      </div>
    </main>
  );
}