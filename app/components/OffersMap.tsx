"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import Link from "next/link";

type MapOffer = {
  id: string;
  title: string;
  pickup_place: string;
  price_amount: number | null;
  price_unit: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
};

type UserLocation = {
  latitude: number;
  longitude: number;
} | null;

function priceUnit(unit: string | null) {
  if (unit === "hour") return "hodinu";
  if (unit === "day") return "den";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";
  if (unit === "piece") return "rezervaci";
  return "";
}

function MapUpdater({ userLocation }: { userLocation: UserLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!userLocation) return;

    map.setView([userLocation.latitude, userLocation.longitude], 13, {
      animate: false,
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [map, userLocation]);

  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  useMapEvents({
    zoomend(event) {
      onZoom(event.target.getZoom());
    },
  });

  return null;
}

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function OffersMap({
  items,
  userLocation,
}: {
  items: MapOffer[];
  userLocation: UserLocation;
}) {
  const [zoom, setZoom] = useState(11);

  const mapOffers = items.filter(
    (item) => item.pickup_latitude !== null && item.pickup_longitude !== null
  );

  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : mapOffers.length > 0
      ? [mapOffers[0].pickup_latitude!, mapOffers[0].pickup_longitude!]
      : [49.4144, 14.6578];

  const groupedOffers = useMemo(() => {
    const precision = zoom >= 14 ? 3 : zoom >= 11 ? 2 : 1;
    const groups = new Map<string, MapOffer[]>();

    mapOffers.forEach((item) => {
      const lat = item.pickup_latitude!.toFixed(precision);
      const lng = item.pickup_longitude!.toFixed(precision);
      const key = `${lat},${lng}`;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries()).map(([key, grouped]) => {
      const [lat, lng] = key.split(",").map(Number);

      return {
        lat,
        lng,
        items: grouped,
      };
    });
  }, [mapOffers, zoom]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full rounded-[2rem]"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ResizeMap />

      <ZoomWatcher onZoom={setZoom} />
      <MapUpdater userLocation={userLocation} />

      {userLocation && (
        <CircleMarker
          center={[userLocation.latitude, userLocation.longitude]}
          radius={11}
          pathOptions={{
            color: "#1D4ED8",
            fillColor: "#3B82F6",
            fillOpacity: 0.95,
          }}
        >
          <Tooltip permanent direction="top">
            Ty
          </Tooltip>
        </CircleMarker>
      )}

      {groupedOffers.map((group) => (
        <CircleMarker
          key={`${group.lat}-${group.lng}`}
          center={[group.lat, group.lng]}
          radius={group.items.length > 1 ? 22 : 15}
          pathOptions={{
            color: "#536426",
            fillColor: "#6B7F32",
            fillOpacity: 0.9,
          }}
        >
          <Tooltip permanent direction="center" className="koluj-map-count">
            {group.items.length}
          </Tooltip>

          <Popup className="koluj-map-popup">
            <div className="w-[240px]">
              <div className="mb-3">
                <p className="text-sm font-black">
                  {group.items.length === 1
                    ? "1 nabídka v místě"
                    : `${group.items.length} nabídky v místě`}
                </p>
                <p className="truncate text-xs text-[var(--koluj-muted)]">
                  {group.items[0]?.pickup_place}
                </p>
              </div>

              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/offers/${item.id}`}
                    className="block rounded-xl border border-[var(--koluj-border)] bg-white px-3 py-2 hover:bg-[var(--koluj-bg)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-black leading-tight">
                        {item.title}
                      </p>

                      {item.price_amount && item.price_unit && (
                        <p className="shrink-0 rounded-full bg-[var(--koluj-green)] px-2 py-1 text-[11px] font-black text-white">
                          {item.price_amount} Kč
                        </p>
                      )}
                    </div>

                    {item.price_amount && item.price_unit && (
                      <p className="mt-1 text-xs text-[var(--koluj-muted)]">
                        za {priceUnit(item.price_unit)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      
    </MapContainer>
  );
}