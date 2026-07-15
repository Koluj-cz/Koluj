"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  CalendarDays,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import PageLoader from "@/app/components/PageLoader";
import OfferSearchFilters from "@/app/components/OfferSearchFilters";
import BackLink from "@/app/components/BackLink";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
  offerTypeLabels,
} from "@/lib/constants";



function getCategoryOptions(offerType: string) {
  if (offerType === "service") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
    };
  }

  if (offerType === "item") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    };
  }

  return {
    all: "Všechny kategorie",
    ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
  };
}

type Offer = OfferCardOffer & {
  publication_status: "active" | "inactive";
  borrow_count: number | null;
};

export default function MyOffersPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [offerType, setOfferType] = useState("all");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(8);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadOffers = useCallback(async () => {
    const response = await fetch("/api/dashboard/my-offers", {
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Nabídky se nepodařilo načíst");
      setLoading(false);
      return;
    }

    setItems((result?.offers || []) as Offer[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    setVisibleCount(8);
  }, [deferredSearchQuery, offerType, category, statusFilter, sortBy]);


  const toggleVisibility = useCallback(async (item: Offer) => {
    const nextStatus =
      item.publication_status === "active" ? "inactive" : "active";

    const response = await fetch("/api/dashboard/my-offers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerId: item.id,
        publicationStatus: nextStatus,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Nabídku se nepodařilo upravit");
      return;
    }

    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? { ...current, publication_status: nextStatus }
          : current
      )
    );

    toast.success(
      nextStatus === "active"
        ? "Nabídka je znovu viditelná"
        : "Nabídka je skrytá",
    );
  }, []);


  const archiveOffer = useCallback(async (item: Offer) => {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    const response = await fetch("/api/offers/archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerId: item.id,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Nabídka se nepodařilo archivovat");
      return;
    }

    setItems((current) =>
      current.filter((i) => i.id !== item.id)
    );

    setPendingDeleteId(null);
    toast.success("Nabídka byla archivována");
  }, [pendingDeleteId]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      available: items.filter((item) => item.publication_status === "active" && !item.is_reserved_today).length,
      reserved: items.filter((item) => item.publication_status === "active" && item.is_reserved_today).length,
    };
  }, [items]);

  const filteredOffers = useMemo(() => {
    let result = [...items];

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();

      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place}`
          .toLowerCase()
          .includes(query)
      );
    }

    if (offerType !== "all") {
      result = result.filter((item) => (item.offer_type || "item") === offerType);
    }

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (statusFilter === "available") {
      result = result.filter((item) => item.publication_status === "active" && !item.is_reserved_today);
    }

    if (statusFilter === "reserved") {
      result = result.filter((item) => item.publication_status === "active" && item.is_reserved_today);
    }

    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    if (sortBy === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title, "cs"));
    }

    if (sortBy === "za") {
      result.sort((a, b) => b.title.localeCompare(a.title, "cs"));
    }

    return result;
  }, [items, deferredSearchQuery, offerType, category, statusFilter, sortBy]);

  const visibleOffers = filteredOffers.slice(0, visibleCount);

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <BackLink href="/dashboard">Dashboard</BackLink>
          </div>

          <h1 className="koluj-heading mt-6">Moje nabídky</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Spravuj své nabídky, sleduj jejich stav a rezervace.
          </p>
        </section>

        <section className="mt-6">
          <OfferSearchFilters
            search={searchQuery}
            onSearchChange={setSearchQuery}
            offerType={offerType}
            onOfferTypeChange={(value) => {
              setOfferType(value);
              setCategory("all");
            }}
            offerTypeOptions={[
              { value: "all", label: "Vše" },
              ...Object.entries(offerTypeLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            category={category}
            onCategoryChange={setCategory}
            categoryOptions={Object.entries(getCategoryOptions(offerType)).map(
              ([value, label]) => ({ value, label })
            )}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={[
              { value: "all", label: `Všechny stavy (${counts.all})` },
              { value: "available", label: `Volné (${counts.available})` },
              { value: "reserved", label: `Rezervované (${counts.reserved})` },
            ]}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOptions={[
              { value: "newest", label: "Nejnovější" },
              { value: "oldest", label: "Nejstarší" },
              { value: "az", label: "Název A–Z" },
              { value: "za", label: "Název Z–A" },
            ]}
          />

          <div className="mb-8 mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="font-bold text-[var(--koluj-muted)]">
              {filteredOffers.length}{" "}
              {filteredOffers.length === 1 ? "nabídku" : "nabídek"}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="koluj-card p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                <Box size={36} />
              </div>

              <h2 className="text-3xl font-black">Zatím nemáš žádnou nabídku</h2>

              <p className="mt-3 text-lg text-[var(--koluj-muted)]">
                Přidej první nabídku a začni rezervovat.
              </p>

            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="koluj-card p-10 text-center">
              <h2 className="text-2xl font-black">Nic nenalezeno</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit vyhledávání nebo filtr.
              </p>
            </div>
          ) : (
            <div className="koluj-offer-grid-wide">
              {visibleOffers.map((item) => (
                <OwnerOfferCard
                  key={item.id}
                  item={item}
                  pendingDeleteId={pendingDeleteId}
                  onToggleVisibility={toggleVisibility}
                  onArchiveOffer={archiveOffer}
                  onClearPendingDelete={() => setPendingDeleteId(null)}
                />
              ))}
            </div>
          )}

          {visibleCount < filteredOffers.length && (
            <div className="pt-8 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 8)}
                className="koluj-button-secondary min-h-[52px] px-8"
              >
                Načíst další
              </button>

              <p className="mt-3 text-sm text-[var(--koluj-muted)]">
                Zobrazeno {visibleOffers.length} z {filteredOffers.length} nabídek
              </p>
            </div>
          )}
        </section>

        <section className="koluj-card mt-10 px-8 py-6">
          <p className="text-[var(--koluj-muted)]">
            <span className="font-bold text-[var(--koluj-green)]">Tip:</span>{" "}
            Udržuj své nabídky aktuální. Zvyšuješ tím šanci, že si je někdo rezervuje.
          </p>
        </section>
      </div>
    </main>
  );
}


const OwnerOfferCard = memo(function OwnerOfferCard({
  item,
  pendingDeleteId,
  onToggleVisibility,
  onArchiveOffer,
  onClearPendingDelete,
}: {
  item: Offer;
  pendingDeleteId: string | null;
  onToggleVisibility: (item: Offer) => void;
  onArchiveOffer: (item: Offer) => void;
  onClearPendingDelete: () => void;
}) {
  const footer = useMemo(
    () => (
      <>
        {item.publication_status === "inactive" && (
          <p className="mb-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-2 text-sm font-bold text-[var(--koluj-muted)]">
            Skryto pro ostatní
          </p>
        )}

        <div className="grid grid-cols-4 gap-1">
          <Link
            href={`/offers/${item.id}`}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]"
          >
            <CalendarDays size={18} />
            Detail
          </Link>

          <Link
            href={`/offers/${item.id}/edit`}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-text)] hover:bg-[var(--koluj-bg)]"
          >
            <Pencil size={18} />
            Upravit
          </Link>

          <button
            type="button"
            onClick={() => onToggleVisibility(item)}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]"
          >
            {item.publication_status === "active" ? (
              <>
                <EyeOff size={18} />
                Skrýt
              </>
            ) : (
              <>
                <Eye size={18} />
                Obnovit
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onArchiveOffer(item)}
            onMouseLeave={onClearPendingDelete}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight ${
              pendingDeleteId === item.id
                ? "bg-red-50 text-red-600"
                : "text-[var(--koluj-muted)] hover:bg-[var(--koluj-bg)]"
            }`}
          >
            <Trash2 size={18} />
            {pendingDeleteId === item.id ? "Opravdu?" : "Odstranit"}
          </button>
        </div>
      </>
    ),
    [item, onArchiveOffer, onClearPendingDelete, onToggleVisibility, pendingDeleteId],
  );

  return <OfferCard item={item} variant="owner" footer={footer} />;
});
