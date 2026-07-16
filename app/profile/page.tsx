"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, User } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import PushNotificationButton from "@/app/components/PushNotificationButton";
import ConfirmLeaveDialog from "@/app/components/ConfirmLeaveDialog";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import StickySidebar from "@/app/components/StickySidebar";

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    city: "",
    phone: "",
    bio: "",
    email: "",
    latitude: null as number | null,
    longitude: null as number | null,
    email_notifications_enabled: true,
    marketing_notifications_enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);

  const currentSnapshot = useMemo(() => JSON.stringify(profile), [profile]);
  const hasUnsavedChanges =
    !loading && Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;

  useUnsavedChangesWarning(
    hasUnsavedChanges && !saving && !allowNavigation,
    setPendingNavigationHref,
  );

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/profile", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/login?redirectTo=/profile";
        return;
      }

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.profile) {
        toast.error(result?.error || "Profil se nepodařilo načíst");
        return;
      }

      const data = result.profile;

      const nextProfile = {
        full_name: data.full_name || "",
        city: data.city || "",
        phone: data.phone || "",
        bio: data.bio || "",
        email: data.email || "",
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        email_notifications_enabled:
          data.email_notifications_enabled ?? true,
        marketing_notifications_enabled:
          data.marketing_notifications_enabled ?? false,
      };

      setProfile(nextProfile);
      setInitialSnapshot(JSON.stringify(nextProfile));
    } catch (error) {
      console.error(error);
      toast.error("Profil se nepodařilo načíst");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);


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

    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: profile.full_name,
          city: profile.city,
          phone: profile.phone,
          bio: profile.bio,
          latitude: profile.latitude,
          longitude: profile.longitude,
          email_notifications_enabled:
            profile.email_notifications_enabled,
          marketing_notifications_enabled:
            profile.marketing_notifications_enabled,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(result?.error || "Profil se nepodařilo uložit");
        return;
      }

      setInitialSnapshot(JSON.stringify(profile));
      toast.success("Profil uložen");
    } catch (error) {
      console.error(error);
      toast.error("Profil se nepodařilo uložit");
    } finally {
      setSaving(false);
    }
  }

  function requestLeaveConfirmation(action: () => void) {
    if (!hasUnsavedChanges || allowNavigation) {
      action();
      return;
    }

    setPendingLeaveAction(() => action);
  }

  async function deactivateAccount() {
    requestLeaveConfirmation(() => {
      void deactivateAccountConfirmed();
    });
  }

  async function deactivateAccountConfirmed() {
    setDeletingAccount(true);

    try {
      const response = await fetch("/api/account/deactivate", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Nepodařilo se deaktivovat účet");
        return;
      }

      await fetch("/api/auth/signout", {
        method: "POST",
      });

      setAllowNavigation(true);
      toast.success("Účet byl deaktivován");
      router.push("/");
    } catch (error) {
      console.error(error);
      toast.error("Nepodařilo se deaktivovat účet");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function logout() {
    requestLeaveConfirmation(() => {
      void logoutConfirmed();
    });
  }

  async function logoutConfirmed() {
    const response = await fetch("/api/auth/signout", {
      method: "POST",
    });

    if (!response.ok) {
      toast.error("Odhlášení se nepodařilo");
      return;
    }

    setAllowNavigation(true);
    toast.success("Byl jsi odhlášen");
    router.push("/");
  }

  function leaveWithoutSaving() {
    setAllowNavigation(true);

    if (pendingLeaveAction) {
      const action = pendingLeaveAction;
      setPendingLeaveAction(null);
      action();
      return;
    }

    const href = pendingNavigationHref;

    if (!href) return;

    setPendingNavigationHref(null);

    const nextUrl = new URL(href, window.location.href);
    router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <main className="koluj-home min-h-screen overflow-x-hidden text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard"
              prefetch={false}
              className="koluj-header-button !hidden md:!inline-flex"
            >
              <ArrowLeft size={17} />
              Dashboard
            </Link>
          </div>

          <h1 className="koluj-heading mt-6">Profil</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Vyplň základní údaje, aby ostatní věděli, s kým si nabídku předávají.
          </p>

        </section>

        <section className="mt-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            <div className="koluj-card min-w-0 overflow-hidden p-5 md:p-8">
              <SectionTitle icon={<Mail size={24} />} title="Přihlášení" />

              <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] px-5 py-4">
                <p className="text-sm font-bold text-[var(--koluj-muted)]">
                  Přihlášený e-mail
                </p>
                <p className="mt-1 break-all text-lg font-bold">{profile.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-5 rounded-2xl border border-[var(--koluj-border)] px-5 py-3 font-black hover:bg-[var(--koluj-bg)]"
              >
                Odhlásit se
              </button>
            </div>
            <div className="koluj-card min-w-0 overflow-hidden p-5 md:p-8">
              <SectionTitle
                icon={<Mail size={24} />}
                title="Notifikace"
              />

              <button
                type="button"
                onClick={() =>
                  setProfile({
                    ...profile,
                    email_notifications_enabled:
                      !profile.email_notifications_enabled,
                  })
                }
                className="mt-6 flex w-full min-w-0 flex-col items-stretch gap-4 rounded-3xl bg-[var(--koluj-bg)] px-4 py-4 text-left hover:opacity-90 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-bold">E-mailové notifikace</p>

                  <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                    Žádosti o rezervaci, nové zprávy a změny stavu rezervací.
                  </p>
                </div>

                <div className="grid w-full shrink-0 grid-cols-2 rounded-2xl bg-white p-1 sm:w-auto">
                  <span
                    className={`rounded-xl px-4 py-2 text-sm font-black ${
                      profile.email_notifications_enabled
                        ? "bg-[var(--koluj-green)] text-white"
                        : "text-[var(--koluj-muted)]"
                    }`}
                  >
                    Zapnuto
                  </span>

                  <span
                    className={`rounded-xl px-4 py-2 text-sm font-black ${
                      !profile.email_notifications_enabled
                        ? "bg-[var(--koluj-green)] text-white"
                        : "text-[var(--koluj-muted)]"
                    }`}
                  >
                    Vypnuto
                  </span>
                </div>
              </button>
              <PushNotificationButton />
              {isIOS && (
                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[var(--koluj-muted)]">
                  Na iPhonu nejdříve přidej Koluj na plochu přes Sdílet → Přidat na plochu.
                  Push notifikace půjdou zapnout až po instalaci aplikace.
                </p>
              )}
            </div>
            <div className="koluj-card min-w-0 overflow-hidden p-5 md:p-8">
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
                    Vyber místo z našeptávače. Díky tomu později zobrazíme nabídky
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
                    Telefon později použijeme pro ověření a bezpečné předání nabídek.
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
            <div className="koluj-card min-w-0 overflow-hidden border border-red-200 p-5 md:p-8">
              <h2 className="text-2xl font-black text-red-600">
                Deaktivace účtu
              </h2>

              <p className="mt-3 text-[var(--koluj-muted)]">
                Deaktivací účtu se skryje tvůj profil i všechny tvoje nabídky.
                Historie rezervací zůstane zachována kvůli ostatním uživatelům.
                Kdykoliv se můžeš znovu přihlásit a účet se automaticky obnoví.
              </p>

              <button
                onClick={() => setShowDeleteAccount(true)}
                className="mt-6 rounded-2xl bg-red-600 px-6 py-3 font-black text-white hover:bg-red-700"
              >
                Deaktivovat účet
              </button>
              {showDeleteAccount && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="font-bold text-red-700">
                    Opravdu chceš deaktivovat svůj účet?
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setShowDeleteAccount(false)}
                      className="rounded-xl border border-[var(--koluj-border)] px-4 py-2 font-bold"
                    >
                      Zrušit
                    </button>

                    <button
                      onClick={deactivateAccount}
                      disabled={deletingAccount}
                      className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                      {deletingAccount
                        ? "Deaktivuji účet..."
                        : "Ano, deaktivovat účet"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="xl:hidden">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="koluj-button w-full px-6 py-4 disabled:opacity-60"
              >
                {saving ? "Ukládám..." : "Uložit profil"}
              </button>
            </div>

          </div>

          <StickySidebar>
            <div className="koluj-card p-8">
              <h2 className="text-2xl font-black">Kontrola profilu</h2>

              <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                <CheckLine done={!!profile.email} text="Přihlášený e-mail" />
                <CheckLine done={!!profile.full_name} text="Vyplněné jméno" />
                <CheckLine done={!!profile.latitude} text="Vybraná lokalita" />
              </ul>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="koluj-button mt-8 w-full px-6 py-4 disabled:opacity-60"
              >
                {saving ? "Ukládám..." : "Uložit profil"}
              </button>
            </div>
          </StickySidebar>
            </div>
          </div>
        </section>

        <ConfirmLeaveDialog
          open={Boolean(pendingNavigationHref || pendingLeaveAction)}
          onStay={() => {
            setPendingNavigationHref(null);
            setPendingLeaveAction(null);
          }}
          onLeave={leaveWithoutSaving}
        />
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

