"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AddOfferDashboardCard() {
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("full_name, city, latitude, longitude")
      .eq("id", user.id)
      .single();

    setProfileComplete(
      Boolean(data?.full_name && data?.city && data?.latitude && data?.longitude)
    );

    setLoading(false);
  }

  const href = profileComplete ? "/offers/new" : "/profile";

  return (
    <Link
      href={href}
      className={`koluj-card group relative overflow-hidden p-8 ${
        !profileComplete && !loading
          ? "opacity-55 grayscale hover:translate-y-0"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <h2 className="text-3xl font-black tracking-tight">Přidat nabídku</h2>

        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
          {profileComplete ? <Plus size={32} /> : <Lock size={32} />}
        </span>
      </div>

      <p className="mt-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
        {profileComplete
          ? "Přidej novou nabídku, kterou chceš nabídnout ostatním."
          : "Nejdřív dokonči profil, aby lidé věděli, s kým a kde si nabídku předávají."}
      </p>

      <p className="koluj-link mt-14">
        {profileComplete ? "Přidat" : "Dokončit profil"} →
      </p>

      <div className="absolute bottom-0 right-0 h-24 w-40 rounded-tl-full bg-[var(--koluj-bg)] opacity-70" />
    </Link>
  );
}