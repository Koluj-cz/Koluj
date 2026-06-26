"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function RestoreAccountOnLogin() {
  useEffect(() => {
    async function restoreAccount() {
      const response = await fetch("/api/account/restore", {
        method: "POST",
      });

      const result = await response.json().catch(() => null);

      if (result?.restored) {
        toast.success("Účet byl znovu aktivován");
      }
    }

    restoreAccount();
  }, []);

  return null;
}