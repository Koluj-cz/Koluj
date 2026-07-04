"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Props = {
  className?: string;
};

export default function AuthHeaderButton({ className = "" }: Props) {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
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
      className={`koluj-header-button ${className}`}
    >
      {isLoggedIn ? "Můj prostor" : "Přihlášení"}
    </Link>
  );
}