"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  className?: string;
};

export default function AuthHeaderButton({ className = "" }: Props) {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const response = await fetch("/api/me", { cache: "no-store" });
      setIsLoggedIn(response.ok);
      setLoading(false);
    }

    loadUser();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <Link
      href={isLoggedIn ? "/dashboard" : "/login"}
      prefetch={false}
      className={`koluj-header-button ${className}`}
    >
      {isLoggedIn ? "Můj prostor" : "Přihlášení"}
    </Link>
  );
}
