"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      await supabase.auth.getSession();
      router.push("/dashboard");
    }

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8f5]">
      <p>Přihlašuji...</p>
    </main>
  );
}