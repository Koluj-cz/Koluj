"use client";

import { useEffect } from "react";

export function useUnsavedChangesWarning(
  active: boolean,
  onNavigationBlocked: (href: string) => void,
) {
  useEffect(() => {
    if (!active) return;

    const message = "Máš neuložené změny. Opravdu chceš odejít?";

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;
      return message;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.href.startsWith("mailto:")) return;

      const nextUrl = new URL(anchor.href, window.location.href);

      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      onNavigationBlocked(nextUrl.href);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [active, onNavigationBlocked]);
}
