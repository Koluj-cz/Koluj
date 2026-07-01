"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  variant?: "button" | "card";
  className?: string;
};

export default function AddOfferButton({
  variant = "button",
  className = "",
}: Props) {
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, city")
      .eq("id", user.id)
      .single();

    setProfileComplete(!!profile?.full_name && !!profile?.city);
  }

  const href = profileComplete ? "/offers/new" : "/profile";
  const icon = profileComplete ? <Plus size={18} /> : <Lock size={18} />;
  const label = profileComplete ? "Přidat nabídku" : "Dokončit profil";

  if (variant === "card") {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}