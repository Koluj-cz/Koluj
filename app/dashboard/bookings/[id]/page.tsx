"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, Send } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/app/components/PageLoader";
import {
  formatDateTime,
  translateBookingStatus,
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
  } | null;
};

type Message = {
  id: string;
  message: string;
  sender_id: string | null;
  is_system: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

export default function BookingDetailPage() {
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSent, setReviewSent] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  function isNearBottom() {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom < 140;
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = "auto") {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    });
  }

  useEffect(() => {
    loadBooking();

    const messagesChannel = supabase
      .channel(`booking-messages-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        async (payload) => {
          const shouldScroll = isNearBottom();

          const { data } = await supabase
            .from("booking_messages")
            .select(`
              *,
              profiles (
                full_name
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (!data) return;

          setMessages((current) => {
            const exists = current.some((msg) => msg.id === data.id);

            if (exists) {
              return current;
            }

            return [...current, data as Message];
          });

          if (shouldScroll) {
            scrollMessagesToBottom("smooth");
          }
        }
      )
      .subscribe();

    const bookingChannel = supabase
      .channel(`booking-status-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        () => {
          loadBooking(false);
        }
      )
      .subscribe();

    const messagesInterval = setInterval(async () => {
      const shouldScroll = isNearBottom();

      const { data } = await supabase
        .from("booking_messages")
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq("booking_id", bookingId)
        .order("created_at");

      if (!data) return;

      
      setMessages((current) => {
        const currentIds = current.map((msg) => msg.id).join(",");
        const nextIds = data.map((msg) => msg.id).join(",");

        if (currentIds === nextIds) {
          return current;
        }

        return data as Message[];
      });

      if (shouldScroll) {
        scrollMessagesToBottom("smooth");
      }
    }, 5000);

    return () => {
      clearInterval(messagesInterval);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(bookingChannel);
    };
  }, [bookingId]);

  async function updatePresence() {
    if (!userId) return;

    await supabase.from("booking_participant_presence").upsert({
      booking_id: bookingId,
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    });
  }

  useEffect(() => {
    if (!userId) return;

    updatePresence();

    const interval = setInterval(() => {
      updatePresence();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, bookingId]);

  async function loadBooking(shouldScrollToBottom = true) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBooking(null);
        return;
      }

      setUserId(user.id);

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          offers:offers (
            id,
            title,
            primary_image_url,
            pickup_place,
            price_amount,
            price_unit,
            deposit,
            offer_type
          ),
          owner:profiles!bookings_owner_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          customer:profiles!bookings_customer_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("id", bookingId)
        .single();

      if (bookingError || !bookingData) {
        console.error("Booking load error:", bookingError);
        toast.error("Rezervaci se nepodařilo načíst");
        setBooking(null);
        return;
      }

      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("reviewer_id", user.id)
        .maybeSingle();

      const { data: messagesData, error: messagesError } = await supabase
        .from("booking_messages")
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq("booking_id", bookingId)
        .order("created_at");

      if (messagesError) {
        console.error("Messages load error:", messagesError);
      }

      setReviewSent(!!existingReview);
      setBooking(bookingData as Booking);
      setMessages((messagesData || []) as Message[]);

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
  }

  async function addSystemMessage(text: string) {
    if (!userId) return;

    await supabase.from("booking_messages").insert({
      booking_id: bookingId,
      sender_id: userId,
      is_system: true,
      message: text,
    });
  }

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
      handed_over_at: result.status === "active" ? result.approvedAt : booking.handed_over_at,
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
    if (!message.trim() || !booking || sendingMessage) return;

    setSendingMessage(true);

    const trimmedMessage = message.trim();

    const response = await fetch("/api/bookings/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: booking.id,
        message: trimmedMessage,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Zprávu se nepodařilo odeslat");
      setSendingMessage(false);
      return;
    }

    setMessage("");
    setSendingMessage(false);
    scrollMessagesToBottom("smooth");
  }

  async function submitReview() {
    if (!booking || !userId || rating === 0) return;

    const reviewedUserId =
      booking.owner_id === userId ? booking.customer_id : booking.owner_id;

    const { error } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      offer_id: booking.offers?.id,
      reviewer_id: userId,
      reviewed_user_id: reviewedUserId,
      rating,
      comment: reviewText,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await addSystemMessage("Hodnocení bylo odesláno.");

    toast.success("Děkujeme za hodnocení");
    setReviewSent(true);
    scrollMessagesToBottom("smooth");
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="min-h-screen">
        <div className="koluj-shell">
          <p>Rezervace nebyla nalezena.</p>
        </div>
      </main>
    );
  }

  const isOwner = booking.owner_id === userId;
  const isService = booking.offers?.offer_type === "service";
  const otherPersonLabel = isOwner ? "Zájemce" : "Vlastník";
  const otherPersonName = isOwner
    ? booking.customer?.full_name || "Uživatel"
    : booking.owner?.full_name || "Uživatel";
  const otherPerson = isOwner ? booking.customer : booking.owner;

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="mb-10">
          <BackLink href="/dashboard/bookings">Rezervace</BackLink>
        </header>

        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
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
                <p><strong>Stav:</strong> {translateBookingStatus(booking.status)}</p>
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
                  <strong>Cena celkem:</strong> {booking.total_price ?? booking.offers?.price_amount ?? 0} Kč
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
                Stav: {translateBookingStatus(booking.status)}
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
                      ? "Služba je schválená. Po dokončení ji označ jako dokončenou."
                      : "Žádost je schválená a termín je rezervovaný v kalendáři. Po předání nabídky potvrď předání."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={isService ? markAsReturned : markAsActive}
                      disabled={saving}
                      className="koluj-button py-3 disabled:opacity-60"
                    >
                      {saving ? "Ukládám..." : isService ? "Potvrdit dokončení" : "Potvrdit předání"}
                    </button>

                    <button
                      type="button"
                      onClick={rejectBooking}
                      disabled={saving}
                      className="rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {saving ? "Ukládám..." : "Zrušit rezervaci"}
                    </button>
                  </div>
                </div>
              )}

              {isOwner && booking.status === "active" && (
                <div>
                  <p className="mb-4 font-bold">{isService ? "Služba je schválená/probíhá. Po dokončení potvrď provedení." : "Rezervace probíhá. Po vrácení nabídky potvrď vrácení."}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={markAsReturned} disabled={saving} className="koluj-button py-3 disabled:opacity-60">
                      {saving ? "Ukládám..." : isService ? "Potvrdit dokončení" : "Potvrdit vrácení"}
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
                <div className="flex gap-3">
                  <input
                    value={message}
                    disabled={sendingMessage}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !sendingMessage) {
                        sendMessage();
                      }
                    }}
                    placeholder="Napiš zprávu..."
                    className="koluj-input flex-1 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sendingMessage}
                    className="koluj-button flex items-center justify-center px-5 disabled:cursor-not-allowed disabled:opacity-60"
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