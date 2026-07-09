"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { OfferCardOffer } from "@/app/components/OfferCard";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-[32px] bg-[var(--koluj-green-pale)] text-sm font-black text-[var(--koluj-green)]">
      Mapa se načítá...
    </div>
  ),
});

type Props = {
  items: OfferCardOffer[];
  userLocation: { latitude: number; longitude: number } | null;
};

export default function LazyOffersMap({ items, userLocation }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);

  useEffect(() => {
    if (shouldLoadMap) return;

    const container = containerRef.current;

    if (!container || !("IntersectionObserver" in window)) {
      setShouldLoadMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "250px",
      },
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [shouldLoadMap]);

  return (
    <div ref={containerRef} className="h-full min-h-[320px]">
      {shouldLoadMap ? (
        <OffersMap items={items} userLocation={userLocation} />
      ) : (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-[32px] bg-[var(--koluj-green-pale)] text-sm font-black text-[var(--koluj-green)]">
          Mapa nabídek
        </div>
      )}
    </div>
  );
}
