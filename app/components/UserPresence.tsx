"use client";

import { useEffect } from "react";

export default function UserPresence() {
  useEffect(() => {
    async function updatePresence() {
      await fetch("/api/presence", {
        method: "POST",
      });
    }

    updatePresence();

    const interval = setInterval(updatePresence, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
