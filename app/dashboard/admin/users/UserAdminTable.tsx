"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  offers: number;
  bookings: number;
  completedBookings: number;
};

export default function UserAdminTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => `${user.name} ${user.email} ${user.id}`.toLowerCase().includes(value));
  }, [query, users]);

  async function toggleBan(user: UserRow) {
    setBusy(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !user.banned }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Akce selhala");
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, banned: !item.banned } : item));
      toast.success(user.banned ? "Ban byl zrušen" : "Uživatel byl zablokován");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akce selhala");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="koluj-card mt-6 p-4 md:p-5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat podle jména, e-mailu nebo ID" className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[var(--koluj-green)]" />
      </div>
      <section className="koluj-card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.025] text-xs uppercase tracking-wide text-[var(--koluj-muted)]"><tr><th className="p-4">Uživatel</th><th className="p-4">Registrace</th><th className="p-4">Nabídky</th><th className="p-4">Rezervace</th><th className="p-4">Dokončeno</th><th className="p-4">Stav</th><th className="p-4 text-right">Akce</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((user) => <tr key={user.id}>
                <td className="p-4"><p className="font-black">{user.name || "Bez jména"}</p><p className="text-[var(--koluj-muted)]">{user.email}</p><p className="mt-1 break-all text-xs text-[var(--koluj-muted)]">{user.id}</p></td>
                <td className="p-4">{new Date(user.createdAt).toLocaleDateString("cs-CZ")}</td><td className="p-4 font-black">{user.offers}</td><td className="p-4 font-black">{user.bookings}</td><td className="p-4 font-black">{user.completedBookings}</td>
                <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${user.banned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{user.banned ? "Zablokován" : "Aktivní"}</span></td>
                <td className="p-4 text-right"><button disabled={busy === user.id} onClick={() => void toggleBan(user)} className={`rounded-xl px-4 py-2 font-black text-white disabled:opacity-50 ${user.banned ? "bg-[var(--koluj-green)]" : "bg-red-600"}`}>{user.banned ? "Zrušit ban" : "Dát ban"}</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="p-10 text-center text-[var(--koluj-muted)]">Žádní uživatelé neodpovídají hledání.</p>}
      </section>
      <p className="mt-4 text-sm text-[var(--koluj-muted)]">Ban zablokuje přihlášení uživatele. Jeho data a nabídky se nemažou. <Link href="/dashboard/moderation" className="font-black text-[var(--koluj-green)]">Otevřít moderaci</Link></p>
    </>
  );
}
