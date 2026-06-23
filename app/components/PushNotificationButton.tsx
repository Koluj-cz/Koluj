"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);

    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function enablePushNotifications() {
    if (!supported) {
      toast.error("Tvoje zařízení nepodporuje push notifikace.");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== "granted") {
      toast.error("Notifikace nejsou povolené.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Pro zapnutí notifikací se přihlas.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      toast.error("Chybí veřejný klíč pro notifikace.");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        subscription,
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      toast.error("Notifikace se nepodařilo zapnout.");
      return;
    }

    toast.success("Push notifikace jsou zapnuté.");
  }

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={enablePushNotifications}
      disabled={permission === "granted"}
      className="mt-4 flex w-full items-center justify-between gap-6 rounded-3xl bg-[var(--koluj-bg)] px-5 py-4 text-left transition hover:opacity-90 disabled:cursor-default disabled:opacity-80"
    >
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--koluj-green)]">
          <Bell size={20} />
        </div>

        <div>
        <p className="font-bold">Push notifikace</p>

        <p className="mt-1 text-sm text-[var(--koluj-muted)]">
            Upozornění přímo do telefonu nebo počítače.
        </p>
        </div>
      </div>

        <div className="flex rounded-2xl bg-white p-1">
        <span
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            permission === "granted"
                ? "bg-[var(--koluj-green)] text-white"
                : "text-[var(--koluj-muted)]"
            }`}
        >
            Zapnuto
        </span>

        <span
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            permission !== "granted"
                ? "bg-[var(--koluj-green)] text-white"
                : "text-[var(--koluj-muted)]"
            }`}
        >
            Vypnuto
        </span>
        </div>
    </button>
  );
}