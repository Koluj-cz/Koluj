"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  MapPin,
  Package,
  Plus,
  Star,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import imageCompression from "browser-image-compression";
import RichTextEditor from "@/app/components/RichTextEditor";
import {
  categories,
  categoryLabels,
  conditions,
  conditionLabels,
  handoverLabels,
  handoverOptions,
} from "@/lib/constants";

type PlaceSuggestion = {
  name: string;
  label?: string;
  location?: string;
  position: { lat: number; lon: number };
};

export default function NewItemPage() {
  const router = useRouter();

  useEffect(() => {
    checkProfile();
  }, []);

  async function checkProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, city")
      .eq("id", user.id)
      .single();

    const profileComplete =
      !!profile?.full_name &&
      !!profile?.city;

    if (!profileComplete) {
      toast.error("Nejdříve dokonči svůj profil");
      router.push("/profile");
    }
  }

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const today = new Date().toISOString().split("T")[0];
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    availability_type: "long_term",
    available_from: "",
    available_to: "",
  });

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
    if (photos.some((photo) => photo.size > 15 * 1024 * 1024)) {
      toast.error("Fotka je příliš velká. Maximum je 15 MB.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Musíš být přihlášený");
      setLoading(false);
      return;
    }

    if (photos.length === 0) {
      toast.error("Nahraj alespoň jednu fotku");
      setLoading(false);
      return;
    }

    if (!form.title.trim()) {
      toast.error("Vyplň název věci");
      setLoading(false);
      return;
    }

    if (!form.category) {
      toast.error("Vyber kategorii");
      setLoading(false);
      return;
    }

    if (!form.condition) {
      toast.error("Vyber stav věci");
      setLoading(false);
      return;
    }

    if (!form.description.trim()) {
      toast.error("Vyplň popis");
      setLoading(false);
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
      setLoading(false);
      return;
    }

    if (form.handover_options.length === 0) {
      toast.error("Vyber alespoň jednu možnost předání");
      setLoading(false);
      return;
    }

    if (
      form.availability_type === "period" &&
      (!form.available_from || !form.available_to)
    ) {
      toast.error("Vyplň dostupnost od/do");
      setLoading(false);
      return;
    }

    const { data: item, error: itemError } = await supabase
      .from("items")
      .insert({
        owner_id: user.id,
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
        availability_type: form.availability_type,
        available_from:
          form.availability_type === "period" ? form.available_from : null,
        available_to:
          form.availability_type === "period" ? form.available_to : null,
        is_active: true,
      })
      .select()
      .single();

    if (itemError || !item) {
      toast.error(itemError?.message || "Nepodařilo se uložit věc");
      setLoading(false);
      return;
    }

    const safeMainPhotoIndex =
      mainPhotoIndex >= 0 && mainPhotoIndex < photos.length
        ? mainPhotoIndex
        : 0;

    const orderedPhotos = [...photos];
    const [mainPhoto] = orderedPhotos.splice(safeMainPhotoIndex, 1);

    if (!mainPhoto) {
      toast.error("Fotku se nepodařilo načíst. Zkus ji vybrat znovu.");
      setLoading(false);
      return;
    }

    const finalPhotos = [mainPhoto, ...orderedPhotos];

    let primaryImageUrl = "";

    setUploadingPhotos(true);
    setUploadProgress(0);
    for (let index = 0; index < finalPhotos.length; index++) {
      
      const photo = finalPhotos[index];
      const filePath = `${user.id}/${item.id}/${index}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("items")
        .upload(filePath, photo);

      if (uploadError) {
        await supabase
          .from("items")
          .delete()
          .eq("id", item.id);

        toast.error("Nepodařilo se nahrát fotku");
        setLoading(false);
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("items")
        .getPublicUrl(filePath);

      if (index === 0) {
        primaryImageUrl = publicUrl.publicUrl;
      }

      await supabase.from("item_images").insert({
        item_id: item.id,
        image_url: publicUrl.publicUrl,
        sort_order: index,
      });
      setUploadProgress(Math.round(((index + 1) / finalPhotos.length) * 100));
    }
    setUploadingPhotos(false);
    await supabase
      .from("items")
      .update({ primary_image_url: primaryImageUrl })
      .eq("id", item.id);

    toast.success("Věc byla přidána");
    router.push("/dashboard/my-items");
  }

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Dashboard
          </Link>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="hidden lg:block koluj-button px-6 py-3 disabled:opacity-60"
        >
          {loading ? "Ukládám..." : "Přidat věc"}
        </button>
        </header>

        <section className="mt-16 px-8">
          <h1 className="koluj-heading">
            Přidat věc
          </h1>

          <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Vyplň jen to důležité. Čím jasnější informace, tím méně zbytečného domlouvání.
          </p>
        </section>

        <section className="mt-14 grid gap-8 px-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div className="koluj-card p-8">
              <SectionTitle icon={<Camera size={24} />} title="Fotky" />

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
                  <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]">
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
                Nahraj 1–8 fotek. Hvězdičkou označ hlavní fotku pro náhled.
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
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))}
                  </select>

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
                          {place.label} {place.location ? `· ${place.location}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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

              <textarea
                value={form.contact_note}
                onChange={(e) => updateField("contact_note", e.target.value)}
                placeholder="Poznámka k předání, např. ideálně po 17:00"
                className="koluj-input mt-5 min-h-28"
              />
            </div>

            <div className="koluj-card p-8">
              <SectionTitle title="Dostupnost" />

              <div className="mt-6 grid gap-4 md:grid-cols-2">

                <select
                  value={form.availability_type}
                  onChange={(e) => updateField("availability_type", e.target.value)}
                  className="koluj-input"
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
                    onChange={(e) => updateField("available_from", e.target.value)}
                    className="koluj-input"
                  />

                  <input
                    type="date"
                    min={form.available_from || today}
                    value={form.available_to}
                    onChange={(e) => updateField("available_to", e.target.value)}
                    className="koluj-input"
                  />
                </div>
              )}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="koluj-card sticky top-8 p-8">
              <h2 className="text-2xl font-black">Kontrola před uložením</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                <CheckLine done={photos.length > 0} text="Alespoň jedna fotka" />
                <CheckLine done={!!form.title} text="Název věci" />
                <CheckLine done={!!form.category} text="Kategorie" />
                <CheckLine done={!!form.condition} text="Stav věci" />
                <CheckLine done={!!form.price_amount && !!form.price_unit} text="Cena" />
                <CheckLine done={!!form.pickup_latitude} text="Místo předání" />
              </ul>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="koluj-button mt-8 w-full px-6 py-4 disabled:opacity-60"
              >
                {loading ? "Ukládám..." : "Přidat věc"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    <div className="fixed right-4 top-4 z-50 lg:hidden">
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="koluj-button px-6 py-3 shadow-2xl disabled:opacity-60"
      >
        {loading ? "Ukládám..." : "Přidat věc"}
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