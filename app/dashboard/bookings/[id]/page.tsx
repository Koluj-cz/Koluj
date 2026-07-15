"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FileText, Paperclip, Printer, Send, X } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import toast from "react-hot-toast";
import PageLoader from "@/app/components/PageLoader";
import {
  formatDateTime,
  getBookingDisplayStatus,
} from "@/lib/format";

type Booking = {
  id: string;
  owner_id: string | null;
  customer_id: string | null;
  status: string;
  created_at: string;
  date_from?: string | null;
  date_to?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  total_price?: number | null;
  approved_at?: string | null;
  returned_at?: string | null;
  handed_over_at?: string | null;
  reviewed?: boolean;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  customer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  offers: {
    id: string;
    title: string;
    primary_image_url: string | null;
    pickup_place: string;
    price_amount: number | null;
    price_unit: string | null;
    deposit: number | null;
    offer_type: string | null;
    service_booking_mode?: string | null;
  } | null;
};

type Message = {
  id: string;
  message: string;
  sender_id: string | null;
  is_system: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
};

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSent, setReviewSent] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom < 140;
  }, []);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    });
  }, []);

  const loadBooking = useCallback(async (shouldScrollToBottom = true) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.booking) {
        toast.error(result?.error || "Rezervaci se nepodařilo načíst");
        setBooking(null);
        return;
      }

      setUserId(result.userId || null);
      setReviewSent(Boolean(result.reviewed));
      setBooking(result.booking as Booking);
      setMessages((result.messages || []) as Message[]);

      if (shouldScrollToBottom) {
        setTimeout(() => scrollMessagesToBottom("auto"), 100);
      }
    } catch (error) {
      console.error("Unexpected booking page error:", error);
      toast.error("Stránku rezervace se nepodařilo načíst");
      setBooking(null);
    } finally {
      setLoading(false);
    }
    }, [bookingId, scrollMessagesToBottom]);

  const updatePresence = useCallback(async () => {
    if (!userId || document.hidden) return;

    await fetch(`/api/bookings/${bookingId}/presence`, {
      method: "POST",
    });
  }, [bookingId, userId]);

  useEffect(() => {
    void loadBooking();

    const interval = setInterval(async () => {
      if (document.hidden) return;

      const shouldScroll = isNearBottom();
      await loadBooking(false);
      if (shouldScroll) scrollMessagesToBottom("smooth");
    }, 15000);

    function handleVisibilityChange() {
      if (!document.hidden) {
        void loadBooking(false);
        void updatePresence();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isNearBottom, loadBooking, scrollMessagesToBottom, updatePresence]);

  useEffect(() => {
    if (!userId) return;

    void updatePresence();

    const interval = setInterval(() => {
      void updatePresence();
    }, 15000);

    return () => clearInterval(interval);
  }, [updatePresence, userId]);

  async function approveBooking() {
    if (!booking) return;

    setSaving(true);

    const response = await fetch("/api/bookings/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Rezervaci se nepodařilo schválit");
      setSaving(false);
      return;
    }

    setBooking({
      ...booking,
      status: result.status || "approved",
      approved_at: result.approvedAt,
      handed_over_at: booking.handed_over_at,
    });
    toast.success(booking.offers?.offer_type === "service" ? "Služba schválena" : "Žádost schválena");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function rejectBooking() {
    if (!booking) return;

    setSaving(true);

    const response = await fetch("/api/bookings/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Rezervaci se nepodařilo odmítnout");
      setSaving(false);
      return;
    }

    setBooking({ ...booking, status: "cancelled" });
    toast.success("Žádost odmítnuta");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function markAsActive() {
    if (!booking) return;

    setSaving(true);

    const response = await fetch("/api/bookings/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Předání se nepodařilo potvrdit");
      setSaving(false);
      return;
    }

    setBooking({ ...booking, status: "active", handed_over_at: result.handedOverAt });
    toast.success("Předání potvrzeno");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function markAsReturned() {
    if (!booking) return;

    setSaving(true);

    const response = await fetch("/api/bookings/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || (booking.offers?.offer_type === "service" ? "Dokončení se nepodařilo potvrdit" : "Vrácení se nepodařilo potvrdit"));
      setSaving(false);
      return;
    }

    setBooking({ ...booking, status: "returned", returned_at: result.returnedAt });
    toast.success(booking.offers?.offer_type === "service" ? "Služba dokončena" : "Vrácení potvrzeno");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function sendMessage() {
    if ((!message.trim() && !messageAttachment) || !booking || sendingMessage) return;

    setSendingMessage(true);

    const formData = new FormData();
    formData.append("bookingId", booking.id);
    formData.append("message", message.trim());
    if (messageAttachment) formData.append("attachment", messageAttachment);

    const response = await fetch("/api/bookings/message", {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Zprávu se nepodařilo odeslat");
      setSendingMessage(false);
      return;
    }

    setMessage("");
    setMessageAttachment(null);
    await loadBooking(false);
    setSendingMessage(false);
    scrollMessagesToBottom("smooth");
  }

  async function submitReview() {
    if (!booking || rating === 0) return;

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
        rating,
        comment: reviewText,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Hodnocení se nepodařilo uložit");
      return;
    }

    toast.success("Děkujeme za hodnocení");
    setReviewSent(true);
    await loadBooking(false);
    scrollMessagesToBottom("smooth");
  }


  if (loading) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <PageLoader />
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <div className="koluj-wide-frame relative z-10">
          <p>Rezervace nebyla nalezena.</p>
        </div>
      </main>
    );
  }

  const isOwner = booking.owner_id === userId;
  const isService = booking.offers?.offer_type === "service";
  const displayStatus = getBookingDisplayStatus({
    status: booking.status,
    offerType: booking.offers?.offer_type,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
  });
  const canFinishService =
    isService &&
    (booking.status === "approved" || booking.status === "active") &&
    (!booking.ends_at || new Date(booking.ends_at) <= new Date());
  const otherPersonLabel = isOwner ? "Zájemce" : "Vlastník";
  const otherPersonName = isOwner
    ? booking.customer?.full_name || "Uživatel"
    : booking.owner?.full_name || "Uživatel";
  const otherPerson = isOwner ? booking.customer : booking.owner;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card mb-6 p-5 md:p-8">
          <BackLink href="/dashboard/bookings">Rezervace</BackLink>
        </section>

        <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="koluj-card p-6">
              <div className="flex items-center gap-4">
                {otherPerson?.avatar_url ? (
                  <img
                    src={otherPerson.avatar_url}
                    alt={otherPerson.full_name || "Uživatel"}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black">
                    {(otherPerson?.full_name || "U")[0]}
                  </div>
                )}

                <div>
                  <p className="text-xl font-black">
                    {otherPerson?.full_name || "Uživatel"}
                  </p>
                  <p className="text-sm text-[var(--koluj-muted)]">
                    {isOwner ? (isService ? "Zákazník služby" : "Zájemce o rezervaci") : (isService ? "Poskytovatel služby" : "Vlastník nabídky")}
                  </p>
                </div>
              </div>

              {otherPerson?.id && (
                <Link
                  href={`/users/${otherPerson.id}`}
                  className="koluj-button mt-5 block text-center"
                >
                  Zobrazit profil
                </Link>
              )}
            </div>

            <div className="koluj-card p-6">
              {booking.offers?.primary_image_url && (
                <img
                  src={booking.offers.primary_image_url}
                  alt={booking.offers.title}
                  className="mb-5 h-56 w-full rounded-2xl object-cover"
                />
              )}

              <h1 className="text-3xl font-black">{booking.offers?.title}</h1>

              <div className="mt-5 space-y-3 text-sm">
                <p><strong>Stav:</strong> {displayStatus.label}</p>
                <p><strong>{otherPersonLabel}:</strong> {otherPersonName}</p>
                <p><strong>Vytvořeno:</strong> {formatDateTime(booking.created_at)}</p>

                {booking.approved_at && (
                  <p><strong>Schváleno:</strong> {formatDateTime(booking.approved_at)}</p>
                )}
                {!isService && booking.handed_over_at && (
                  <p><strong>Předáno:</strong> {formatDateTime(booking.handed_over_at)}</p>
                )}
                {booking.returned_at && (
                  <p><strong>{isService ? "Dokončeno" : "Vráceno"}:</strong> {formatDateTime(booking.returned_at)}</p>
                )}
                {booking.starts_at && booking.ends_at ? (
                  <p><strong>Čas služby:</strong> {formatDateTime(booking.starts_at)} – {formatDateTime(booking.ends_at)}</p>
                ) : booking.date_from && booking.date_to ? (
                  <p><strong>Termín:</strong> {formatDateTime(booking.date_from)} – {formatDateTime(booking.date_to)}</p>
                ) : isService ? (
                  <p><strong>Termín:</strong> domluvou</p>
                ) : null}

                <p><strong>{isService ? "Lokalita působení" : "Místo předání"}:</strong> {booking.offers?.pickup_place}</p>
                <p>
                  <strong>Cena celkem:</strong>{" "}
                  {booking.offers?.price_unit === "individual"
                    ? "individuálně"
                    : `${booking.total_price ?? booking.offers?.price_amount ?? 0} Kč`}
                </p>
                {!isService && <p><strong>Kauce:</strong> {booking.offers?.deposit || 0} Kč</p>}
              </div>

              {isOwner && (
                <Link
                  href={`/dashboard/bookings/${booking.id}/protocol`}
                  target="_blank"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 font-black text-[var(--koluj-green)] shadow-sm hover:shadow-md"
                >
                  <Printer size={18} />
                  {isService ? "Vytisknout protokol o provedení služby" : "Vytisknout protokol o předání"}
                </Link>
              )}
            </div>
          </aside>

          <section className="koluj-card flex h-[740px] flex-col overflow-hidden">
            <div className="border-b border-[var(--koluj-border)] p-5">
              <h2 className="text-xl font-black">{isService ? "Domluva služby" : "Domluva předání"}</h2>
              <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
                Stav: {displayStatus.label}
              </p>
            </div>

            <div className="border-b border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-5">
              {isOwner && booking.status === "requested" && (
                <div>
                  <p className="mb-4 font-bold">{isService ? "Máš novou poptávku služby." : "Máš novou žádost o rezervaci."}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={approveBooking} disabled={saving} className="koluj-button py-3 disabled:opacity-60">
                      {saving ? "Ukládám..." : isService ? "Schválit poptávku" : "Schválit žádost"}
                    </button>
                    <button type="button" onClick={rejectBooking} disabled={saving} className="rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
                      {isService ? "Odmítnout poptávku" : "Odmítnout žádost"}
                    </button>
                  </div>
                </div>
              )}

              {isOwner && booking.status === "approved" && (
                <div>
                  <p className="mb-4 font-bold">
                    {isService
                      ? displayStatus.key === "scheduled"
                        ? "Služba je schválená a čeká na svůj termín."
                        : displayStatus.key === "in_progress"
                          ? "Služba právě probíhá. Dokončení bude možné po skončení rezervovaného času."
                          : "Rezervovaný čas skončil. Potvrď dokončení služby."
                      : "Žádost je schválená a termín je rezervovaný v kalendáři. Po předání nabídky potvrď předání."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={isService ? markAsReturned : markAsActive}
                      disabled={saving || (isService && !canFinishService)}
                      className="koluj-button py-3 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Ukládám..."
                        : isService
                          ? canFinishService
                            ? "Potvrdit dokončení"
                            : "Dokončení zatím není možné"
                          : "Potvrdit předání"}
                    </button>

                    <button
                      type="button"
                      onClick={rejectBooking}
                      disabled={saving}
                      className="rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {saving ? "Ukládám..." : isService ? "Zrušit službu" : "Zrušit rezervaci"}
                    </button>
                  </div>
                </div>
              )}

              {isOwner && booking.status === "active" && (
                <div>
                  <p className="mb-4 font-bold">
                    {isService
                      ? displayStatus.key === "scheduled"
                        ? "Služba je schválená a čeká na svůj termín."
                        : displayStatus.key === "in_progress"
                          ? "Služba právě probíhá."
                          : "Rezervovaný čas skončil. Potvrď dokončení služby."
                      : "Rezervace probíhá. Po vrácení nabídky potvrď vrácení."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={markAsReturned}
                      disabled={saving || (isService && !canFinishService)}
                      className="koluj-button py-3 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Ukládám..."
                        : isService
                          ? canFinishService
                            ? "Potvrdit dokončení"
                            : "Dokončení zatím není možné"
                          : "Potvrdit vrácení"}
                    </button>
                    {isService && (
                      <button type="button" onClick={rejectBooking} disabled={saving} className="rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
                        {saving ? "Ukládám..." : "Zrušit službu"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {booking.status === "returned" && !reviewSent && (
                <div>
                  <h3 className="font-black">Jak proběhla rezervace?</h3>
                  <p className="mt-2 text-sm text-[var(--koluj-muted)]">
                    1 hvězdička = špatná zkušenost, 5 hvězdiček = výborná zkušenost.
                  </p>

                  <div className="mt-4 flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-3xl ${
                          rating >= star ? "text-yellow-500" : "text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder={isService ? "Jak služba proběhla?" : "Jak rezervace proběhla?"}
                    className="koluj-input mt-4 min-h-[100px] w-full"
                  />

                  <button type="button" onClick={submitReview} className="koluj-button mt-4 w-full py-3">
                    Odeslat hodnocení
                  </button>
                </div>
              )}

              {booking.status === "returned" && reviewSent && (
                <p className="font-bold text-[var(--koluj-green)]">
                  Hodnocení už bylo odesláno.
                </p>
              )}

              {booking.status === "cancelled" && (
                <p className="font-bold text-[var(--koluj-muted)]">
                  Tato žádost byla zrušena.
                </p>
              )}

              {!isOwner &&
                booking.status !== "returned" &&
                booking.status !== "cancelled" && (
                  <p className="font-bold text-[var(--koluj-muted)]">
                    {isService ? "Další krok nyní potvrzuje poskytovatel služby." : "Další krok nyní potvrzuje vlastník nabídky."}
                  </p>
                )}
            </div>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={
                      msg.is_system
                        ? "rounded-2xl bg-[var(--koluj-bg)] p-4 text-sm whitespace-pre-line"
                        : msg.sender_id === userId
                        ? "ml-auto max-w-[75%] rounded-2xl bg-[var(--koluj-green)] p-4 text-white"
                        : "max-w-[75%] rounded-2xl bg-[var(--koluj-bg)] p-4"
                    }
                  >
                    {!msg.is_system && msg.sender_id !== userId && (
                      <p className="mb-1 text-xs font-bold opacity-70">
                        {msg.profiles?.full_name || "Uživatel"}
                      </p>
                    )}

                    <p className="whitespace-pre-line">{msg.message}</p>

                    {msg.attachment_url && msg.attachment_name && (
                      msg.attachment_type?.startsWith("image/") ? (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 block overflow-hidden rounded-2xl bg-white/90"
                        >
                          <img
                            src={msg.attachment_url}
                            alt={msg.attachment_name}
                            className="max-h-72 w-full object-contain"
                          />
                          <span className="block truncate px-3 py-2 text-xs font-black text-[var(--koluj-text)]">
                            {msg.attachment_name}
                          </span>
                        </a>
                      ) : (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 flex items-center gap-3 rounded-2xl bg-white/90 p-3 text-[var(--koluj-text)]"
                        >
                          <FileText size={22} className="shrink-0 text-[var(--koluj-green)]" />
                          <span className="min-w-0 truncate text-sm font-black">
                            {msg.attachment_name}
                          </span>
                        </a>
                      )
                    )}

                    <p className="mt-2 text-[11px] font-bold opacity-60">
                      {formatDateTime(msg.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {booking.status === "returned" || booking.status === "cancelled" ? (
              <div className="border-t border-[var(--koluj-border)] p-4">
                <p className="text-center font-bold text-[var(--koluj-muted)]">
                  {isService ? "Chat je po ukončení služby uzamčen." : "Chat je po ukončení rezervace uzamčen."}
                </p>
              </div>
            ) : (
              <div className="border-t border-[var(--koluj-border)] p-4">
                {messageAttachment && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-bold">
                      {messageAttachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMessageAttachment(null)}
                      className="shrink-0 text-red-600"
                      aria-label="Odebrat přílohu"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                <div className="flex gap-2 sm:gap-3">
                  <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-[var(--koluj-border)] bg-white text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
                    <Paperclip size={20} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.zip"
                      className="hidden"
                      disabled={sendingMessage}
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        if (file && file.size > 15 * 1024 * 1024) {
                          toast.error("Příloha může mít maximálně 15 MB");
                          event.currentTarget.value = "";
                          return;
                        }
                        setMessageAttachment(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <input
                    value={message}
                    disabled={sendingMessage}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !sendingMessage) {
                        void sendMessage();
                      }
                    }}
                    placeholder="Napiš zprávu..."
                    className="koluj-input min-w-0 flex-1 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sendingMessage || (!message.trim() && !messageAttachment)}
                    className="koluj-button flex items-center justify-center px-4 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
                  >
                    {sendingMessage ? (
                      <span className="text-sm font-black">...</span>
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}