"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function UserPresence() {
  useEffect(() => {
    async function updatePresence() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    updatePresence();

    const interval = setInterval(updatePresence, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}