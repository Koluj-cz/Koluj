"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("koluj-cookie-consent");
    setVisible(!consent);
  }, []);

  function acceptCookies() {
    localStorage.setItem("koluj-cookie-consent", "accepted");
    setVisible(false);
  }

  function declineCookies() {
    localStorage.setItem("koluj-cookie-consent", "necessary");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
      }}
      className="border-t border-[var(--koluj-border)] bg-white shadow-2xl"
    >
      <div className="koluj-cookies py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <h3 className="text-lg font-black">Používáme cookies</h3>

            <p className="mt-2 text-sm leading-relaxed text-[var(--koluj-muted)] md:text-base">
              Používáme nezbytné cookies pro fungování aplikace. Analytické
              cookies použijeme jen pro zlepšování služby, pokud s tím budeš
              souhlasit. Více najdeš na stránce{" "}
              <Link
                href="/legal/cookies"
                className="font-bold text-[var(--koluj-green)] hover:underline"
              >
                Cookies
              </Link>
              .
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={declineCookies}
              className="rounded-full border border-[var(--koluj-border)] px-5 py-3 font-black text-[var(--koluj-muted)] hover:bg-[var(--koluj-bg)]"
            >
              Pouze nezbytné
            </button>

            <button
              type="button"
              onClick={acceptCookies}
              className="koluj-button px-5 py-3"
            >
              Souhlasím
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}