"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  MapPin,
  Package,
  Save,
  Camera,
  Star,
  X,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import RichTextEditor from "@/app/components/RichTextEditor";
import PageLoader from "@/app/components/PageLoader";
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
  itemStatuses,
  itemStatusLabels,
} from "@/lib/constants";

type PlaceSuggestion = {
  name: string;
  label?: string;
  location?: string;
  position: { lat: number; lon: number };
};

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
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
    is_active: true,
  });

  useEffect(() => {
    loadItem();
  }, []);

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

  async function loadItem() {
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("id", itemId)
      .single();

    if (error || !data) {
      toast.error("Nabídku se nepodařilo načíst");
      router.push("/dashboard/my-offers");
      return;
    }

    setForm({
      offer_type: data.offer_type || "item",
      title: data.title || "",
      description: data.description || "",
      category: data.category || "",
      condition: data.condition || "",
      price_amount: data.price_amount?.toString() || "",
      price_unit: data.price_unit || "day",
      price_note: data.price_note || "",
      deposit: data.deposit?.toString() || "",
      pickup_place: data.pickup_place || "",
      pickup_latitude: data.pickup_latitude || null,
      pickup_longitude: data.pickup_longitude || null,
      handover_options: data.handover_options || [],
      contact_note: data.contact_note || "",
      is_active: data.is_active ?? true,
    });

    
    setPrimaryImageUrl(data.primary_image_url || "");

    const { data: imageData } = await supabase
    .from("offer_images")
    .select("*")
    .eq("item_id", itemId)
    .order("sort_order");
    setImages(imageData || []);
    setLoading(false);
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

  async function handlePhotos(files: FileList | null) {
    if (!files) return;

    const selected = Array.from(files);

    if (images.length + newPhotos.length + selected.length > 8) {
      toast.error("Můžeš mít maximálně 8 fotek");
      return;
    }

    const oversized = selected.find(
      (file) => file.size > 15 * 1024 * 1024
    );

    if (oversized) {
      toast.error("Jedna z fotek je větší než 15 MB");
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(10);

    try {
      const compressedFiles = await Promise.all(
        selected.map((file) =>
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

      setNewPhotos((prev) => [...prev, ...compressedFiles]);

      setNewPhotoPreviews((prev) => [
        ...prev,
        ...compressedFiles.map((file) =>
          URL.createObjectURL(file)
        ),
      ]);
    } catch {
      toast.error("Fotku se nepodařilo zpracovat");
      setUploadingPhotos(false);
      setUploadProgress(0);
    }
  }

async function deleteImage(imageId: string, imageUrl: string) {
  const { error: deleteDbError } = await supabase
    .from("offer_images")
    .delete()
    .eq("id", imageId);

  if (deleteDbError) {
    toast.error(deleteDbError.message);
    return;
  }

  const marker = "/storage/v1/object/public/offers/";
  const storagePath = imageUrl.includes(marker)
    ? imageUrl.split(marker)[1]
    : null;

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("offers")
      .remove([storagePath]);

    if (storageError) {
      toast.error(storageError.message);
      return;
    }
  }

  const remainingImages = images.filter((img) => img.id !== imageId);
  setImages(remainingImages);

  if (primaryImageUrl === imageUrl) {
    const nextPrimary = remainingImages[0]?.image_url || null;

    await supabase
      .from("offers")
      .update({
        primary_image_url: nextPrimary,
      })
      .eq("id", itemId);

    setPrimaryImageUrl(nextPrimary || "");
  }

  toast.success("Fotka smazána");
}

async function makePrimary(imageUrl: string) {
  const { error } = await supabase
    .from("offers")
    .update({
      primary_image_url: imageUrl,
    })
    .eq("id", itemId);

  if (error) {
    toast.error(error.message);
    return;
  }

  toast.success("Hlavní fotka nastavena");

  setPrimaryImageUrl(imageUrl);
}

  async function saveItem() {
    if (form.offer_type === "item" && images.length + newPhotos.length === 0) {
    toast.error("Nahraj alespoň jednu fotku věci");
    return;
    }
    if (!form.title.trim()) {
      toast.error("Vyplň název nabídky");
      return;
    }

    if (!form.category) {
      toast.error("Vyber kategorii");
      return;
    }

    if (form.offer_type === "item" && !form.condition) {
      toast.error("Vyber stav nabídky");
      return;
    }

    if (!form.description.trim()) {
      toast.error("Vyplň popis");
      return;
    }

    if (!form.price_amount.trim()) {
    toast.error("Vyplň cenu");
    setLoading(false);
    return;
    }

    if (!form.price_unit) {
    toast.error("Vyber jednotku ceny");
    setLoading(false);
    return;
    }

    if (!form.pickup_place.trim() || !form.pickup_latitude || !form.pickup_longitude) {
      toast.error(
        form.offer_type === "service"
          ? "Vyber lokalitu působení z našeptávače nebo zvol celou ČR"
          : "Vyber místo předání z našeptávače"
      );
      return;
    }

    if (form.offer_type === "item" && form.handover_options.length === 0) {
      toast.error("Vyber alespoň jednu možnost předání");
      return;
    }

    
    setSaving(true);

    const { error } = await supabase
      .from("offers")
      .update({
        offer_type: form.offer_type,
        title: form.title,
        description: form.description,
        category: form.category,
        condition: form.offer_type === "item" ? form.condition : null,
        price_amount: Number(form.price_amount),
        price_unit: form.price_unit,
        price_note: form.price_note || null,
        deposit: form.offer_type === "item" && form.deposit ? Number(form.deposit) : null,
        pickup_place: form.pickup_place,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
        handover_options:
          form.offer_type === "item" ? form.handover_options : [],
        contact_note: form.contact_note,
        is_active: form.is_active,
      })
      .eq("id", itemId);

        if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
        }

        if (newPhotos.length > 0) {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            toast.error("Nejsi přihlášený");
            setSaving(false);
            return;
        }

        const currentCount = images.length;
        
        setUploadingPhotos(true);
        setUploadProgress(0);
        for (let index = 0; index < newPhotos.length; index++) {
            const photo = newPhotos[index];
            const filePath = `${user.id}/${itemId}/${Date.now()}-${index}.webp`;

            const { error: uploadError } = await supabase.storage
            .from("offers")
            .upload(filePath, photo);

            if (uploadError) {
            toast.error(uploadError.message);
            setSaving(false);
            return;
            }

            const { data: publicUrl } = supabase.storage
            .from("offers")
            .getPublicUrl(filePath);

            const sortOrder = currentCount + index;

            const { error: imageError } = await supabase.from("offer_images").insert({
            item_id: itemId,
            image_url: publicUrl.publicUrl,
            sort_order: sortOrder,
            });

            if (imageError) {
            toast.error(imageError.message);
            setSaving(false);
            return;
            }

            if (images.length === 0 && index === 0) {
            await supabase
                .from("offers")
                .update({
                primary_image_url: publicUrl.publicUrl,
                })
                .eq("id", itemId);
            }
            setUploadProgress(Math.round(((index + 1) / newPhotos.length) * 100));
        }
        }
        setUploadingPhotos(false);
        setSaving(false);
        toast.success("Změny uloženy");
        router.push("/dashboard/my-offers");
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <BackLink href="/dashboard/my-offers">Moje nabídky</BackLink>

          <button
            onClick={saveItem}
            disabled={saving}
            className="hidden lg:flex koluj-button items-center gap-2 px-6 py-3 disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Ukládám..." : "Uložit změny"}
          </button>
        </header>

        <section className="mt-16 px-8">
          <h1 className="koluj-heading">
            Upravit nabídku
          </h1>

          <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Uprav informace, cenu a základní nastavení nabídky.
          </p>
        </section>

        <section className="mt-14 grid gap-8 px-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">

        <div className="koluj-card p-8">
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
                        price_unit: type === "service" ? "hour" : prev.price_unit || "day",
                        deposit: type === "service" ? "" : prev.deposit,
                        handover_options: type === "service" ? [] : prev.handover_options,
                      }))
                    }
                    className={`rounded-3xl px-5 py-4 text-left font-black transition ${
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

        <div className="koluj-card p-8">
        <SectionTitle
            icon={<Camera size={24} />}
            title={form.offer_type === "service" ? "Fotky služby" : "Fotky věci"}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">

            {images.map((image) => (
            <div
                key={image.id}
                className="relative overflow-hidden rounded-3xl border border-[var(--koluj-border)]"
            >
                <img
                src={image.image_url}
                className="h-36 w-full object-cover"
                />

                <button
                type="button"
                onClick={() => makePrimary(image.image_url)}
                className={`absolute left-2 top-2 rounded-full p-2 shadow-sm ${
                    primaryImageUrl === image.image_url
                    ? "bg-white text-[var(--koluj-green)]"
                    : "bg-white text-[var(--koluj-muted)]"
                }`}
                >
                <Star
                    size={18}
                    fill={primaryImageUrl === image.image_url ? "currentColor" : "none"}
                />
                </button>

                <button
                type="button"
                onClick={() => deleteImage(image.id, image.image_url)}
                className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-500 shadow"
                >
                <X size={16} />
                </button>
                {primaryImageUrl === image.image_url && (
                <div className="absolute bottom-2 left-2 rounded-full bg-[var(--koluj-green)] px-3 py-1 text-xs font-bold text-white">
                    Hlavní
                </div>
                )}
            </div>
            ))}

            {newPhotoPreviews.map((preview, index) => (
            <div
                key={index}
                className="overflow-hidden rounded-3xl border border-[var(--koluj-border)]"
            >
                <img
                src={preview}
                className="h-36 w-full object-cover"
                />
            </div>
            ))}

            <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--koluj-border)]">
            <Plus size={24} />

            <span className="mt-2 text-sm font-bold">
                Přidat fotku
            </span>

            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handlePhotos(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            </label>
        </div>

            <p className="mt-4 text-sm text-[var(--koluj-muted)]">
              {form.offer_type === "service"
                ? "Fotky jsou u služby volitelné. Pomůžou ale zvýšit důvěryhodnost nabídky."
                : "U věci doporučujeme mít alespoň jednu fotku."}
            </p>

            {uploadingPhotos && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm font-bold text-[var(--koluj-muted)]">
                  <span>Zpracovávám fotky...</span>
                  <span>{uploadProgress}%</span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[var(--koluj-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--koluj-green)] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
        </div>
            <div className="koluj-card p-8">
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

            <div className="koluj-card p-8">
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
                    <option value="hour">za hodinu</option>
                    {form.offer_type === "item" && (
                      <>
                        <option value="day">za den</option>
                        <option value="weekend">za víkend</option>
                        <option value="week">za týden</option>
                        <option value="month">za měsíc</option>
                        <option value="piece">za rezervaci</option>
                      </>
                    )}
                    {form.offer_type === "service" && (
                      <option value="piece">za službu</option>
                    )}
                </select>
                </div>

                <textarea
                value={form.price_note}
                onChange={(e) => updateField("price_note", e.target.value)}
                placeholder="Poznámka k ceně, např. víkend za 250 Kč nebo sleva při delším rezervaci"
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

            <div className="koluj-card p-8">
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
                          {place.label}{" "}
                          {place.location ? `· ${place.location}` : ""}
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
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-bold transition ${
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
                placeholder={form.offer_type === "service" ? "Poznámka ke službě, např. dojezd, online varianta nebo ideální časy" : "Poznámka k předání"}
                className="koluj-input mt-5 min-h-28"
              />
            </div>

            <div className="koluj-card p-8">
              <SectionTitle title="Dostupnost" />

              <div className="mt-6 rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-6">
                <p className="text-lg font-bold text-[var(--koluj-green)]">
                  📅 Dostupnost se spravuje v kalendáři této nabídky.
                </p>

                <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
                  Kalendář najdeš v detailu nabídky. Zde můžeš blokovat vlastní termíny,
                  schvalovat rezervace a sledovat obsazené dny.
                </p>
              </div>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="koluj-card sticky top-8 p-8">
              <h2 className="text-2xl font-black">Kontrola</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                {form.offer_type === "item" ? (
                  <CheckLine done={images.length + newPhotos.length > 0} text="Alespoň jedna fotka" />
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
                onClick={saveItem}
                disabled={saving}
                className="koluj-button mt-8 w-full px-6 py-4 disabled:opacity-60"
              >
                {saving ? "Ukládám..." : "Uložit změny"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    <div className="fixed right-4 top-4 z-50 lg:hidden">
      <button
        type="button"
        onClick={saveItem}
        disabled={saving}
        className="koluj-button flex items-center gap-2 px-6 py-3 shadow-2xl disabled:opacity-60"
      >
        <Save size={18} />
        {saving ? "Ukládám..." : "Uložit změny"}
      </button>
    </div>
    </main>
  );
}

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
          {icon}
        </div>
      )}
      <h2 className="text-2xl font-black">{title}</h2>
    </div>
  );
}

function CheckLine({ done, text }: { done: boolean; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          done
            ? "bg-[var(--koluj-green)] text-white"
            : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
        }`}
      >
        {done ? <Check size={14} /> : ""}
      </span>
      {text}
    </li>
  );
}