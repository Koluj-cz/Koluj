"use client";

import { useEffect, useState } from "react";
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
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);

    if (isSupported) {
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();

    setEnabled(Boolean(subscription));
  }

  async function enablePushNotifications() {
    if (!supported) return;

    setSaving(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error("Notifikace nejsou povolené.");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        toast.error("Chybí veřejný klíč pro notifikace.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Pro zapnutí notifikací se přihlas.");
        return;
      }

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
        await subscription.unsubscribe();
        setEnabled(false);
        toast.error("Notifikace se nepodařilo uložit.");
        return;
      }

      setEnabled(true);
      toast.success("Push notifikace jsou zapnuté.");
      } catch (error) {
        console.error(error);

        try {
          const registration = await navigator.serviceWorker.getRegistration("/sw.js");
          const subscription = await registration?.pushManager.getSubscription();

          if (subscription) {
            await subscription.unsubscribe();
          }
        } catch {}

        setEnabled(false);
        toast.error("Notifikace se nepodařilo zapnout. Zkus to prosím znovu.");
      } finally {
      setSaving(false);
    }
  }

  async function disablePushNotifications() {
    setSaving(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      setEnabled(false);
      toast.success("Push notifikace jsou vypnuté.");
    } catch (error) {
      console.error(error);
      toast.error("Notifikace se nepodařilo vypnout.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePushNotifications() {
    if (saving) return;

    if (enabled) {
      await disablePushNotifications();
    } else {
      await enablePushNotifications();
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={togglePushNotifications}
      disabled={saving}
      className="mt-4 flex w-full items-center justify-between gap-6 rounded-3xl bg-[var(--koluj-bg)] px-5 py-4 text-left transition hover:opacity-90 disabled:opacity-70"
    >
      <div>
        <p className="font-bold">Push notifikace</p>
        <p className="mt-1 text-sm text-[var(--koluj-muted)]">
          Upozornění přímo do telefonu nebo počítače.
        </p>
      </div>

      <div className="flex rounded-2xl bg-white p-1">
        <span
          className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            enabled
              ? "bg-[var(--koluj-green)] text-white"
              : "text-[var(--koluj-muted)]"
          }`}
        >
          Zapnuto
        </span>

        <span
          className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            !enabled
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