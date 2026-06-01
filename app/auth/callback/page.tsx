"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      await supabase.auth.getSession();
      router.replace("/dashboard");
    }

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5]">
      <p>Přihlašuji...</p>
    </main>
  );
}