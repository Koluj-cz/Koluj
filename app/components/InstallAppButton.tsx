"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
};

type InstallAppButtonProps = {
  iconOnly?: boolean;
};

export default function InstallAppButton({ iconOnly = false }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () =>
      window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  if (!deferredPrompt) return null;

  if (iconOnly) {
    return (
      <button
        onClick={installApp}
        title="Instalovat aplikaci"
        aria-label="Instalovat aplikaci"
        className="koluj-button-secondary flex h-[52px] w-[52px] shrink-0 items-center justify-center p-0"
      >
        <Download size={20} />
      </button>
    );
  }

  return (
    <button
      onClick={installApp}
      title="Instalovat aplikaci"
      className="koluj-button-secondary h-[52px] px-4"
    >
      <Download size={18} />
      <span>Instalovat aplikaci</span>
    </button>
  );
}
