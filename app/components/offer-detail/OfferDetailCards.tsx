"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Handshake, MapPin, ShieldCheck } from "lucide-react";
import { handoverLabels } from "@/lib/constants";
import type { ItemDetail } from "./types";

export function MetaAndDescriptionCard({ item }: { item: ItemDetail }) {
  if (!item.description) return null;

  return (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Popis</h2>
      <div
        className="koluj-rich-text mt-3 text-lg leading-relaxed text-[var(--koluj-muted)]"
        dangerouslySetInnerHTML={{ __html: item.description }}
      />
    </div>
  );
}

function InfoLine({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--koluj-border)] p-5">
      <div className="flex items-center gap-3 text-[var(--koluj-green)]">
        {icon}
        <p className="font-black">{title}</p>
      </div>
      <p className="mt-3 text-[var(--koluj-muted)]">{text}</p>
    </div>
  );
}

export function HandoverCard({ item }: { item: ItemDetail }) {
  return (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Předání</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoLine
          icon={<MapPin size={20} />}
          title={
            item.offer_type === "service" ? "Lokalita působení" : "Místo předání"
          }
          text={item.pickup_place}
        />
        {item.offer_type !== "service" && (
          <InfoLine
            icon={<Handshake size={20} />}
            title="Možnosti předání"
            text={
              item.handover_options?.length
                ? item.handover_options
                    .map((option) => handoverLabels[option] || option)
                    .join(", ")
                : "Domluvou"
            }
          />
        )}
        {item.contact_note && (
          <InfoLine
            icon={<Check size={20} />}
            title="Poznámka k předání"
            text={item.contact_note}
          />
        )}
      </div>
    </div>
  );
}

export function OwnerCard({
  item,
  ratingText,
  ratingCountText,
}: {
  item: ItemDetail;
  ratingText: string;
  ratingCountText: string;
}) {
  const ownerName = item.profiles?.full_name || "Uživatel";

  return (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Vlastník</h2>
      <Link
        href={`/users/${item.owner_id}`}
        className="mt-5 flex items-center gap-4 hover:opacity-80"
      >
        {item.profiles?.avatar_url ? (
          <Image
            src={item.profiles.avatar_url}
            alt={ownerName}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-xl font-black text-[var(--koluj-green)]">
            {ownerName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xl font-black">{ownerName}</p>
          <p className="font-bold text-[var(--koluj-green)]">
            {ratingText}
            {ratingCountText && (
              <span className="ml-1 text-[var(--koluj-muted)]">
                {ratingCountText}
              </span>
            )}
          </p>
        </div>
      </Link>
      {item.profiles?.is_verified && (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-4 py-2 text-sm font-bold text-[var(--koluj-green)]">
          <ShieldCheck size={16} />
          Ověřený profil
        </p>
      )}
    </div>
  );
}
