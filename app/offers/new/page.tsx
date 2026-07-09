"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  MapPin,
  Package,
  Plus,
  Star,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import BackLink from "@/app/components/BackLink";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
  offerTypeLabels,
  conditions,
  conditionLabels,
  handoverLabels,
  handoverOptions,
  itemPriceUnits,
  itemPriceUnitLabels,
  servicePriceUnits,
  servicePriceUnitLabels,
} from "@/lib/constants";
import SectionTitle from "@/app/components/SectionTitle";
import CheckLine from "@/app/components/CheckLine";

const RichTextEditor = dynamic(() => import("@/app/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-[var(--koluj-border)] bg-white p-4 text-sm font-bold text-[var(--koluj-muted)]">
      Editor popisu se načítá...
    </div>
  ),
});

type PlaceSuggestion = {
  name: string;
  label?: string;
  location?: string;
  position: { lat: number; lon: number };
};

export default function NewItemPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [form, setForm] = useState({
    offer_type: "item",
    title: "",
    description: "",
    category: "",
    condition: "",
    price_amount: "",
    price_unit: "day",
    price_note: "",
    deposit: "",
    pickup_place: "",
    pickup_latitude: null as number | null,
    pickup_longitude: null as number | null,
    handover_options: [] as string[],
    contact_note: "",
  });
  const [allowNavigation, setAllowNavigation] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    return (
      photos.length > 0 ||
      form.offer_type !== "item" ||
      form.title.trim() !== "" ||
      form.description.trim() !== "" ||
      form.category !== "" ||
      form.condition !== "" ||
      form.price_amount.trim() !== "" ||
      form.price_unit !== "day" ||
      form.price_note.trim() !== "" ||
      form.deposit.trim() !== "" ||
      form.pickup_place.trim() !== "" ||
      form.pickup_latitude !== null ||
      form.pickup_longitude !== null ||
      form.handover_options.length > 0 ||
      form.contact_note.trim() !== ""
    );
  }, [form, photos.length]);

  useUnsavedChangesWarning(hasUnsavedChanges && !loading && !allowNavigation);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleHandoverOption(option: string) {
    setForm((prev) => {
      const exists = prev.handover_options.includes(option);

      return {
        ...prev,
        handover_options: exists
          ? prev.handover_options.filter((item) => item !== option)
          : [...prev.handover_options, option],
      };
    });
  }

  async function handlePhotos(files: FileList | null) {
    if (!files) return;

    const selectedFiles = Array.from(files);

    if (photos.length + selectedFiles.length > 8) {
      toast.error("Můžeš nahrát maximálně 8 fotek");
      return;
    }

    const oversized = selectedFiles.find(
      (file) => file.size > 15 * 1024 * 1024
    );

    if (oversized) {
      toast.error("Jedna z fotek je větší než 15 MB");
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(10);
    
    try {
      const imageCompression = (await import("browser-image-compression")).default;

      const compressedFiles = await Promise.all(
        selectedFiles.map((file) =>
          imageCompression(file, {
          maxSizeMB: 0.7,
          maxWidthOrHeight: 1400,
          useWebWorker: true,
          fileType: "image/webp",
        })
      )
    );
    setUploadProgress(100);
    setUploadingPhotos(false);

      setPhotos((prev) => [...prev, ...compressedFiles]);

      setPhotoPreviews((prev) => [
        ...prev,
        ...compressedFiles.map((file) => URL.createObjectURL(file)),
      ]);
    } catch {
      toast.error("Fotku se nepodařilo zpracovat");
      setUploadingPhotos(false);
      setUploadProgress(0);
    }
  }

  function removePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index);
    const newPreviews = photoPreviews.filter((_, i) => i !== index);

    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);

    if (mainPhotoIndex === index) {
      setMainPhotoIndex(0);
    } else if (mainPhotoIndex > index) {
      setMainPhotoIndex(mainPhotoIndex - 1);
    }
  }

  async function searchPlaces(value: string) {
    setForm({
      ...form,
      pickup_place: value,
      pickup_latitude: null,
      pickup_longitude: null,
    });

    if (value.length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    const response = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
    const data = await response.json();

    setPlaceSuggestions(data.items || []);
  }

  function selectPlace(place: PlaceSuggestion) {
    setForm({
      ...form,
      pickup_place: `${place.name}${place.location ? `, ${place.location}` : ""}`,
      pickup_latitude: place.position.lat,
      pickup_longitude: place.position.lon,
    });

    setPlaceSuggestions([]);
  }

  async function handleSubmit() {
    setLoading(true);

    try {
      if (photos.some((photo) => photo.size > 15 * 1024 * 1024)) {
        throw new Error("Fotka je příliš velká. Maximum je 15 MB.");
      }

      if (form.offer_type === "item" && photos.length === 0) {
        throw new Error("Nahraj alespoň jednu fotku věci");
      }

      if (!form.title.trim()) {
        throw new Error("Vyplň název nabídky");
      }

      if (!form.category) {
        throw new Error("Vyber kategorii");
      }

      if (form.offer_type === "item" && !form.condition) {
        throw new Error("Vyber stav nabídky");
      }

      if (!form.description.trim()) {
        throw new Error("Vyplň popis");
      }

      if (!form.price_amount.trim()) {
        throw new Error("Vyplň cenu");
      }

      if (!form.price_unit) {
        throw new Error("Vyber jednotku ceny");
      }

      if (!form.pickup_place.trim() || !form.pickup_latitude || !form.pickup_longitude) {
        throw new Error(
          form.offer_type === "service"
            ? "Vyber lokalitu působení z našeptávače nebo zvol celou ČR"
            : "Vyber místo předání z našeptávače"
        );
      }

      if (form.offer_type === "item" && form.handover_options.length === 0) {
        throw new Error("Vyber alespoň jednu možnost předání");
      }

      const formData = new FormData();
      formData.append("payload", JSON.stringify(form));
      formData.append("mainPhotoIndex", String(mainPhotoIndex));

      const safeMainPhotoIndex =
        mainPhotoIndex >= 0 && mainPhotoIndex < photos.length ? mainPhotoIndex : 0;
      const orderedPhotos = [...photos];
      const [mainPhoto] = orderedPhotos.splice(safeMainPhotoIndex, 1);
      const finalPhotos = mainPhoto ? [mainPhoto, ...orderedPhotos] : orderedPhotos;

      setUploadingPhotos(finalPhotos.length > 0);
      setUploadProgress(finalPhotos.length > 0 ? 20 : 0);

      finalPhotos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const response = await fetch("/api/offers", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Nepodařilo se uložit nabídku");
      }

      setUploadProgress(100);
      setAllowNavigation(true);
      toast.success("Nabídka byla přidána");
      router.push("/dashboard/my-offers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodařilo se uložit nabídku");
    } finally {
      setUploadingPhotos(false);
      setLoading(false);
    }
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/dashboard">Dashboard</BackLink>
          </div>

          <h1 className="koluj-heading mt-6">Přidat nabídku</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Vyplň jen to důležité. Nabídnout můžeš věc i službu.
          </p>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<Package size={24} />} title="Co chceš nabídnout?" />

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {["item", "service"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        offer_type: type,
                        category: "",
                        condition: type === "service" ? "" : prev.condition,
                        price_unit: type === "service" ? "hour" : "day",
                        deposit: type === "service" ? "" : prev.deposit,
                        handover_options: type === "service" ? [] : prev.handover_options,
                      }))
                    }
                    className={`rounded-3xl px-5 py-4 text-left font-black ${
                      form.offer_type === type
                        ? "bg-[var(--koluj-green)] text-white"
                        : "bg-[var(--koluj-bg)] text-[var(--koluj-text)]"
                    }`}
                  >
                    {offerTypeLabels[type as keyof typeof offerTypeLabels]}
                    <span className="mt-1 block text-sm font-bold opacity-80">
                      {type === "item"
                        ? "Fyzická věc s předáním a rezervací po dnech."
                        : "Čas, práce nebo pomoc s rezervací po hodinách."}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<Camera size={24} />} title={form.offer_type === "service" ? "Fotky služby" : "Fotky věci"} />

              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {photoPreviews.map((preview, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)]"
                  >
                    <img
                      src={preview}
                      alt="Náhled fotky"
                      className="h-36 w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => setMainPhotoIndex(index)}
                      className="absolute left-2 top-2 rounded-full bg-white p-2 text-[var(--koluj-green)] shadow-sm"
                    >
                      <Star
                        size={18}
                        fill={mainPhotoIndex === index ? "currentColor" : "none"}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-500 shadow-sm"
                    >
                      <X size={18} />
                    </button>

                    {mainPhotoIndex === index && (
                      <div className="absolute bottom-2 left-2 rounded-full bg-[var(--koluj-green)] px-3 py-1 text-xs font-bold text-white">
                        Hlavní
                      </div>
                    )}
                  </div>
                ))}

                {photos.length < 8 && (
                  <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
                    <Plus size={30} />
                    <span className="mt-2 text-sm font-bold">Přidat</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        handlePhotos(e.target.files);
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <p className="mt-4 text-sm text-[var(--koluj-muted)]">
                {form.offer_type === "service"
                  ? "Fotky jsou u služby volitelné. Pomůžou ale zvýšit důvěryhodnost nabídky."
                  : "Nahraj 1–8 fotek. Hvězdičkou označ hlavní fotku pro náhled."}
              </p>
              {uploadingPhotos && (
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-sm font-bold text-[var(--koluj-muted)]">
                    <span>Zpracovávám fotky...</span>
                    <span>{uploadProgress}%</span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-[var(--koluj-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--koluj-green)]"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<Package size={24} />} title="O nabídce" />

              <div className="mt-6 space-y-4">
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder={form.offer_type === "service" ? "Název služby *" : "Název nabídky *"}
                  className="koluj-input"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="koluj-input"
                  >
                    <option value="">Kategorie *</option>
                    {(form.offer_type === "service" ? serviceCategories : categories).map((category) => (
                      <option key={category} value={category}>
                        {form.offer_type === "service"
                          ? serviceCategoryLabels[category as keyof typeof serviceCategoryLabels]
                          : categoryLabels[category as keyof typeof categoryLabels]}
                      </option>
                    ))}
                  </select>

                  {form.offer_type === "item" && (
                    <select
                      value={form.condition}
                      onChange={(e) => updateField("condition", e.target.value)}
                      className="koluj-input"
                    >
                      <option value="">Stav věci *</option>
                      {conditions.map((condition) => (
                        <option key={condition} value={condition}>
                          {conditionLabels[condition]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

              <RichTextEditor
                value={form.description}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    description: value,
                  }))
                }
              />
              </div>
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle title="Cena" />

              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <input
                    type="number"
                    min="0"
                    value={form.price_amount}
                    onChange={(e) => updateField("price_amount", e.target.value)}
                    placeholder="Cena v Kč *"
                    className="koluj-input"
                  />

                  <select
                    value={form.price_unit}
                    onChange={(e) => updateField("price_unit", e.target.value)}
                    className="koluj-input"
                  >
                    {(form.offer_type === "service" ? servicePriceUnits : itemPriceUnits).map((unit) => (
                      <option key={unit} value={unit}>
                        {form.offer_type === "service"
                          ? servicePriceUnitLabels[unit]
                          : itemPriceUnitLabels[unit]}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={form.price_note}
                  onChange={(e) => updateField("price_note", e.target.value)}
                  placeholder="Poznámka k ceně, např. víkend za 250 Kč nebo sleva při delší rezervaci"
                  className="koluj-input min-h-28"
                />


                {form.offer_type === "item" && (
                  <input
                    type="number"
                    value={form.deposit}
                    onChange={(e) => updateField("deposit", e.target.value)}
                    placeholder="Kauce Kč, volitelné"
                    className="koluj-input"
                  />
                )}
              </div>
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<MapPin size={24} />} title={form.offer_type === "service" ? "Lokalita působení" : "Předání"} />

              <div className="relative mt-6">
                <input
                  value={form.pickup_place}
                  onChange={(e) => searchPlaces(e.target.value)}
                  placeholder={form.offer_type === "service" ? "Lokalita působení *" : "Místo předání *"}
                  className="koluj-input"
                />

                {form.offer_type === "service" && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        pickup_place: "Celá Česká republika",
                        pickup_latitude: 49.8175,
                        pickup_longitude: 15.473,
                      }));
                      setPlaceSuggestions([]);
                    }}
                    className="mt-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm font-black text-[var(--koluj-green)]"
                  >
                    Působím po celé ČR
                  </button>
                )}

                {placeSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-surface)] shadow-lg">
                    {placeSuggestions.map((place, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="block w-full px-5 py-4 text-left hover:bg-[var(--koluj-bg)]"
                      >
                        <div className="font-bold">{place.name}</div>
                        <div className="text-sm text-[var(--koluj-muted)]">
                          {place.label} {place.location ? `· ${place.location}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.offer_type === "item" && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {handoverOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleHandoverOption(value)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-bold ${
                      form.handover_options.includes(value)
                        ? "border-[var(--koluj-green)] bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                        : "border-[var(--koluj-border)] text-[var(--koluj-muted)]"
                    }`}
                  >
                    {form.handover_options.includes(value) && <Check size={18} />}
                    {handoverLabels[value]}
                  </button>
                  ))}
                </div>
              )}

              <textarea
                value={form.contact_note}
                onChange={(e) => updateField("contact_note", e.target.value)}
                placeholder={form.offer_type === "service" ? "Poznámka ke službě, např. dojezd, online varianta nebo ideální časy" : "Poznámka k předání, např. ideálně po 17:00"}
                className="koluj-input mt-5 min-h-28"
              />
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle title="Dostupnost" />

              <div className="mt-6 rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-6">
                <p className="text-lg font-bold text-[var(--koluj-green)]">
                  📅 Dostupnost se nastavuje až po vytvoření nabídky.
                </p>

                <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
                  Po uložení budeš moci v detailu nabídky spravovat kalendář dostupnosti,
                  blokovat termíny a schvalovat rezervace. Ostatní uživatelé okamžitě uvidí,
                  které dny jsou volné a které obsazené.
                </p>
              </div>
            </div>
            <div className="xl:hidden">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="koluj-button w-full px-6 py-4 disabled:opacity-60"
              >
                <Plus size={18} />
                {loading ? "Ukládám..." : "Přidat nabídku"}
              </button>
            </div>

          </div>

          <aside className="hidden self-start xl:block">
            <div className="koluj-card sticky top-28 p-8">
              <h2 className="text-2xl font-black">Kontrola před uložením</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                {form.offer_type === "item" ? (
                  <CheckLine done={photos.length > 0} text="Alespoň jedna fotka" />
                ) : (
                  <CheckLine done={true} text="Fotky jsou volitelné" />
                )}
                <CheckLine done={!!form.title} text="Název nabídky" />
                <CheckLine done={!!form.category} text="Kategorie" />
                {form.offer_type === "item" && (
                  <CheckLine done={!!form.condition} text="Stav věci" />
                )}
                <CheckLine done={!!form.price_amount && !!form.price_unit} text="Cena" />
                {form.offer_type === "item" ? (
                  <CheckLine done={!!form.pickup_latitude} text="Místo předání" />
                ) : (
                  <CheckLine done={!!form.pickup_latitude} text="Lokalita působení" />
                )}
              </ul>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="koluj-button mt-8 w-full px-6 py-4 disabled:opacity-60"
              >
                {loading ? "Ukládám..." : "Přidat nabídku"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
function useUnsavedChangesWarning(active: boolean) {
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

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [active]);
}
