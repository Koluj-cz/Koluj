"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ModerationActions({ table, id }: { table: string; id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function update(status: "approved" | "rejected") {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/moderation/${table}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Akce selhala");
      toast.success(status === "approved" ? "Médium schváleno" : "Médium zamítnuto");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akce selhala");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex gap-2">
    <button disabled={busy} onClick={() => void update("approved")} className="rounded-xl bg-[var(--koluj-green)] px-3 py-2 text-sm font-black text-white disabled:opacity-50">Schválit</button>
    <button disabled={busy} onClick={() => void update("rejected")} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50">Zamítnout</button>
  </div>;
}
