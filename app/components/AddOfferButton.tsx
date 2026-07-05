"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";

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
    async function loadProfileState() {
      const response = await fetch("/api/me", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      setProfileComplete(Boolean(response.ok && result?.profileComplete));
    }

    loadProfileState();
  }, []);

  const href = profileComplete ? "/offers/new" : "/profile";
  const icon = profileComplete ? <Plus size={18} /> : <Lock size={18} />;
  const label = profileComplete ? "Přidat nabídku" : "Dokončit profil";

  if (variant === "card") {
    return (
      <Link href={href} prefetch={false} className={className}>
        {icon}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link href={href} prefetch={false} className={className}>
      {icon}
      {label}
    </Link>
  );
}
