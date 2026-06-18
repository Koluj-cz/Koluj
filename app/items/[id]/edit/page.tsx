"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
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
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
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
    status: "available",
    availability_type: "long_term",
    available_from: "",
    available_to: "",
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
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (error || !data) {
      toast.error("Věc se nepodařilo načíst");
      router.push("/dashboard/my-items");
      return;
    }

    setForm({
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
      status: data.status || "available",
      availability_type: data.availability_type || "long_term",
      available_from: data.available_from || "",
      available_to: data.available_to || "",
      is_active: data.is_active ?? true,
    });

    
    setPrimaryImageUrl(data.primary_image_url || "");

    const { data: imageData } = await supabase
    .from("item_images")
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

      setNewPhotos((prev) => [...prev, ...compressedFiles]);

      setNewPhotoPreviews((prev) => [
        ...prev,
        ...compressedFiles.map((file) =>
          URL.createObjectURL(file)
        ),
      ]);
    } catch {
      toast.error("Fotku se nepodařilo zpracovat");
    }
  }

async function deleteImage(imageId: string, imageUrl: string) {
  const { error: deleteDbError } = await supabase
    .from("item_images")
    .delete()
    .eq("id", imageId);

  if (deleteDbError) {
    toast.error(deleteDbError.message);
    return;
  }

  const marker = "/storage/v1/object/public/items/";
  const storagePath = imageUrl.includes(marker)
    ? imageUrl.split(marker)[1]
    : null;

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("items")
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
      .from("items")
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
    .from("items")
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
    if (images.length + newPhotos.length === 0) {
    toast.error("Nahraj alespoň jednu fotku");
    return;
    }
    if (!form.title.trim()) {
      toast.error("Vyplň název věci");
      return;
    }

    if (!form.category) {
      toast.error("Vyber kategorii");
      return;
    }

    if (!form.condition) {
      toast.error("Vyber stav věci");
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
      toast.error("Vyber místo předání z našeptávače");
      return;
    }

    if (form.handover_options.length === 0) {
      toast.error("Vyber alespoň jednu možnost předání");
      return;
    }

    if (
      form.availability_type === "period" &&
      (!form.available_from || !form.available_to)
    ) {
      toast.error("Vyplň dostupnost od/do");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("items")
      .update({
        title: form.title,
        description: form.description,
        category: form.category,
        condition: form.condition,
        price_amount: Number(form.price_amount),
        price_unit: form.price_unit,
        price_note: form.price_note || null,
        deposit: form.deposit ? Number(form.deposit) : null,
        pickup_place: form.pickup_place,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
        handover_options: form.handover_options,
        contact_note: form.contact_note,
        status: form.status,
        availability_type: form.availability_type,
        available_from:
          form.availability_type === "period" ? form.available_from : null,
        available_to:
          form.availability_type === "period" ? form.available_to : null,
        is_active: form.is_active,
      })
      .eq("id", itemId);

    setSaving(false);

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

        for (let index = 0; index < newPhotos.length; index++) {
            const photo = newPhotos[index];
            const filePath = `${user.id}/${itemId}/${Date.now()}-${index}.webp`;

            const { error: uploadError } = await supabase.storage
            .from("items")
            .upload(filePath, photo);

            if (uploadError) {
            toast.error(uploadError.message);
            setSaving(false);
            return;
            }

            const { data: publicUrl } = supabase.storage
            .from("items")
            .getPublicUrl(filePath);

            const sortOrder = currentCount + index;

            const { error: imageError } = await supabase.from("item_images").insert({
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
                .from("items")
                .update({
                primary_image_url: publicUrl.publicUrl,
                })
                .eq("id", itemId);
            }
        }
        }

        setSaving(false);
        toast.success("Změny uloženy");
        router.push("/dashboard/my-items");
  }

  if (loading) {
    return (
      <main className="min-h-screen pb-24 lg:pb-0">
        <div className="koluj-shell">
          <p>Načítám...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard/my-items"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Moje věci
          </Link>

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
            Upravit věc
          </h1>

          <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Uprav informace, stav a dostupnost věci.
          </p>
        </section>

        <section className="mt-14 grid gap-8 px-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">

        <div className="koluj-card p-8">
        <SectionTitle
            icon={<Camera size={24} />}
            title="Fotky"
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
                onChange={(e) => handlePhotos(e.target.files)}
            />
            </label>

        </div>
        </div>
            <div className="koluj-card p-8">
              <SectionTitle icon={<Package size={24} />} title="O věci" />

              <div className="mt-6 space-y-4">
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Název věci *"
                  className="koluj-input"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="koluj-input"
                  >
                    <option value="">Kategorie *</option>
                    <option value="naradi">Nářadí</option>
                    <option value="elektronika">Elektronika</option>
                    <option value="sport">Sport</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="dum_zahrada">Dům a zahrada</option>
                    <option value="auto_moto">Auto/Moto</option>
                    <option value="foto_video">Foto a video</option>
                    <option value="party_akce">Party a akce</option>
                    <option value="ostatni">Ostatní</option>
                  </select>

                  <select
                    value={form.condition}
                    onChange={(e) => updateField("condition", e.target.value)}
                    className="koluj-input"
                  >
                    <option value="">Stav věci *</option>
                    <option value="new">Nové</option>
                    <option value="like_new">Jako nové</option>
                    <option value="good">Dobrý stav</option>
                    <option value="used">Běžně používané</option>
                  </select>
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
                    <option value="day">za den</option>
                    <option value="weekend">za víkend</option>
                    <option value="week">za týden</option>
                    <option value="month">za měsíc</option>
                    <option value="piece">za půjčení</option>
                </select>
                </div>

                <textarea
                value={form.price_note}
                onChange={(e) => updateField("price_note", e.target.value)}
                placeholder="Poznámka k ceně, např. víkend za 250 Kč nebo sleva při delším půjčení"
                className="koluj-input min-h-28"
                />

                <input
                type="number"
                value={form.deposit}
                onChange={(e) => updateField("deposit", e.target.value)}
                placeholder="Kauce Kč, volitelné"
                className="koluj-input"
                />
            </div>
            </div>

            <div className="koluj-card p-8">
              <SectionTitle icon={<MapPin size={24} />} title="Předání" />

              <div className="relative mt-6">
                <input
                  value={form.pickup_place}
                  onChange={(e) => searchPlaces(e.target.value)}
                  placeholder="Místo předání *"
                  className="koluj-input"
                />

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

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  ["pracovni_dny", "Pracovní dny"],
                  ["vecer_po_praci", "Večer po práci"],
                  ["vikendy", "Víkendy"],
                  ["kdykoliv", "Kdykoliv"],
                ].map(([value, label]) => (
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
                    {label}
                  </button>
                ))}
              </div>

              <textarea
                value={form.contact_note}
                onChange={(e) => updateField("contact_note", e.target.value)}
                placeholder="Poznámka k předání"
                className="koluj-input mt-5 min-h-28"
              />
            </div>

            <div className="koluj-card p-8">
              <SectionTitle title="Dostupnost a viditelnost" />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="koluj-input"
                >
                  <option value="available">Volné</option>
                  <option value="reserved">Rezervované</option>
                  <option value="borrowed">Půjčené</option>
                </select>

                <select
                  value={form.is_active ? "true" : "false"}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.value === "true" })
                  }
                  className="koluj-input"
                >
                  <option value="true">Viditelné pro ostatní</option>
                  <option value="false">Skryté</option>
                </select>

                <select
                  value={form.availability_type}
                  onChange={(e) =>
                    updateField("availability_type", e.target.value)
                  }
                  className="koluj-input md:col-span-2"
                >
                  <option value="long_term">Dlouhodobě k dispozici</option>
                  <option value="period">Jen v určitém období</option>
                </select>
              </div>

              {form.availability_type === "period" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    type="date"
                    min={today}
                    value={form.available_from}
                    onChange={(e) =>
                      updateField("available_from", e.target.value)
                    }
                    className="koluj-input"
                  />

                  <input
                    type="date"
                    min={form.available_from || today}
                    value={form.available_to}
                    onChange={(e) =>
                      updateField("available_to", e.target.value)
                    }
                    className="koluj-input"
                  />
                </div>
              )}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="koluj-card sticky top-8 p-8">
              <h2 className="text-2xl font-black">Kontrola</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                <CheckLine done={images.length + newPhotos.length > 0} text="Alespoň jedna fotka"/>
                <CheckLine done={!!form.title} text="Název věci" />
                <CheckLine done={!!form.category} text="Kategorie" />
                <CheckLine done={!!form.condition} text="Stav věci" />
                <CheckLine done={!!form.price_amount && !!form.price_unit} text="Cena" />
                <CheckLine done={!!form.pickup_latitude} text="Místo předání" />
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