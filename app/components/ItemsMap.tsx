"use client";

import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import Link from "next/link";

type MapItem = {
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
  if (unit === "piece") return "půjčení";
  return "";
}

function MapUpdater({ userLocation }: { userLocation: UserLocation }) {
  const map = useMap();

  if (userLocation) {
    map.flyTo([userLocation.latitude, userLocation.longitude], 13, {
      animate: true,
      duration: 0.8,
    });
  }

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

export default function ItemsMap({
  items,
  userLocation,
}: {
  items: MapItem[];
  userLocation: UserLocation;
}) {
  const [zoom, setZoom] = useState(11);

  const mapItems = items.filter(
    (item) => item.pickup_latitude !== null && item.pickup_longitude !== null
  );

  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : mapItems.length > 0
      ? [mapItems[0].pickup_latitude!, mapItems[0].pickup_longitude!]
      : [49.4144, 14.6578];

  const groupedItems = useMemo(() => {
    const precision = zoom >= 14 ? 3 : zoom >= 11 ? 2 : 1;
    const groups = new Map<string, MapItem[]>();

    mapItems.forEach((item) => {
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
  }, [mapItems, zoom]);

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

      {groupedItems.map((group) => (
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

          <Popup>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="border-b pb-2 last:border-b-0">
                  <p className="font-bold">{item.title}</p>
                  <p>{item.pickup_place}</p>

                  {item.price_amount && item.price_unit && (
                    <p>
                      {item.price_amount} Kč / {priceUnit(item.price_unit)}
                    </p>
                  )}

                  <Link href={`/items/${item.id}`}>Zobrazit detail</Link>
                </div>
              ))}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}