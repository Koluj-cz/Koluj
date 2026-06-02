"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

type PlaceSuggestion = {
  name: string;
  label?: string;
  location?: string;
  position: {
    lat: number;
    lon: number;
  };
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);

  const [profile, setProfile] = useState({
    full_name: "",
    city: "",
    phone: "",
    bio: "",
    email: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    let { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!data) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
      });

      const response = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      data = response.data;
    }

    setProfile({
      full_name: data.full_name || "",
      city: data.city || "",
      phone: data.phone || "",
      bio: data.bio || "",
      email: data.email || "",
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    });

    setLoading(false);
  }

  async function searchPlaces(value: string) {
    setProfile({
      ...profile,
      city: value,
      latitude: null,
      longitude: null,
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
    setProfile({
      ...profile,
      city: `${place.name}${place.location ? `, ${place.location}` : ""}`,
      latitude: place.position.lat,
      longitude: place.position.lon,
    });

    setPlaceSuggestions([]);
  }

  async function saveProfile() {
    if (!profile.full_name.trim()) {
      toast.error("Vyplň své jméno");
      return;
    }

    if (!profile.city.trim()) {
      toast.error("Vyplň město nebo oblast");
      return;
    }

    if (!profile.latitude || !profile.longitude) {
      toast.error("Vyber místo z našeptávače");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Nejsi přihlášený");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        city: profile.city,
        phone: profile.phone,
        bio: profile.bio,
        latitude: profile.latitude,
        longitude: profile.longitude,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Profil uložen");
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="koluj-shell">
          <p>Načítám...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Dashboard
          </Link>

          <button onClick={saveProfile} className="koluj-button px-6 py-3">
            Uložit profil
          </button>
        </header>

        <section className="mt-10 px-0 md:mt-16 md:px-8">
          <h1 className="koluj-serif text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Profil
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:mt-6 md:text-2xl">
            Vyplň základní údaje, aby ostatní věděli, s kým si věc předávají.
          </p>
        </section>

        <section className="mt-10 grid gap-6 px-0 md:mt-14 md:px-0 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<Mail size={24} />} title="Přihlášení" />

              <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] px-5 py-4">
                <p className="text-sm font-bold text-[var(--koluj-muted)]">
                  Přihlášený e-mail
                </p>
                <p className="mt-1 text-lg font-bold">{profile.email}</p>
              </div>
            </div>

            <div className="koluj-card p-5 md:p-8">
              <SectionTitle icon={<User size={24} />} title="Osobní údaje" />

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Jméno <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Např. David"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    className="koluj-input"
                  />
                </div>

                <div className="relative">
                  <label className="mb-2 block text-sm font-bold">
                    Město / oblast <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    placeholder="Začni psát město..."
                    value={profile.city}
                    onChange={(e) => searchPlaces(e.target.value)}
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

                  <p className="mt-2 text-sm text-[var(--koluj-muted)]">
                    Vyber místo z našeptávače. Díky tomu později zobrazíme věci
                    v okolí a na mapě.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Telefon
                  </label>
                  <input
                    type="text"
                    placeholder="Telefon se nebude veřejně zobrazovat"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    className="koluj-input"
                  />
                  <p className="mt-2 text-sm text-[var(--koluj-muted)]">
                    Telefon později použijeme pro ověření a bezpečné předání věcí.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">O mně</label>
                  <textarea
                    placeholder="Krátce napiš, kdo jsi..."
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                    className="koluj-input min-h-36"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="koluj-card sticky top-8 p-8">
              <h2 className="text-2xl font-black">Kontrola profilu</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                <CheckLine done={!!profile.full_name} text="Vyplněné jméno" />
                <CheckLine done={!!profile.latitude} text="Vybraná lokalita" />
                <CheckLine done={!!profile.email} text="Přihlášený e-mail" />
              </ul>

              <button
                onClick={saveProfile}
                className="koluj-button mt-8 w-full px-6 py-4"
              >
                Uložit profil
              </button>
            </div>
          </aside>
        </section>
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
        {done ? "✓" : ""}
      </span>
      {text}
    </li>
  );
}