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
  translatePriceUnit,
  formatDateTime,
  translateLoanStatus,
} from "@/lib/format";

type Loan = {
  id: string;
  owner_id: string | null;
  borrower_id: string | null;
  status: string;
  created_at: string;
  approved_at?: string | null;
  returned_at?: string | null;
  handed_over_at?: string | null;
  reviewed?: boolean;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  borrower: { id: string; full_name: string | null; avatar_url: string | null } | null;
  items: {
    id: string;
    title: string;
    primary_image_url: string | null;
    pickup_place: string;
    price_amount: number | null;
    price_unit: string | null;
    deposit: number | null;
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

export default function LoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<Loan | null>(null);
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
    loadLoan();

    const messagesChannel = supabase
      .channel(`loan-messages-${loanId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "loan_messages",
          filter: `loan_id=eq.${loanId}`,
        },
        async (payload) => {
          const shouldScroll = isNearBottom();

          const { data } = await supabase
            .from("loan_messages")
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

    const loanChannel = supabase
      .channel(`loan-status-${loanId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loans",
          filter: `id=eq.${loanId}`,
        },
        () => {
          loadLoan(false);
        }
      )
      .subscribe();

    const messagesInterval = setInterval(async () => {
      const shouldScroll = isNearBottom();

      const { data } = await supabase
        .from("loan_messages")
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq("loan_id", loanId)
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
      supabase.removeChannel(loanChannel);
    };
  }, [loanId]);

  async function updatePresence() {
    if (!userId) return;

    await supabase.from("loan_participant_presence").upsert({
      loan_id: loanId,
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
  }, [userId, loanId]);

  async function loadLoan(shouldScrollToBottom = true) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoan(null);
        return;
      }

      setUserId(user.id);

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          items (
            id,
            title,
            primary_image_url,
            pickup_place,
            price_amount,
            price_unit,
            deposit
          ),
          owner:profiles!loans_owner_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          borrower:profiles!loans_borrower_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("id", loanId)
        .single();

      if (loanError || !loanData) {
        console.error("Loan load error:", loanError);
        toast.error("Půjčku se nepodařilo načíst");
        setLoan(null);
        return;
      }

      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("loan_id", loanId)
        .eq("reviewer_id", user.id)
        .maybeSingle();

      const { data: messagesData, error: messagesError } = await supabase
        .from("loan_messages")
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq("loan_id", loanId)
        .order("created_at");

      if (messagesError) {
        console.error("Messages load error:", messagesError);
      }

      setReviewSent(!!existingReview);
      setLoan(loanData as Loan);
      setMessages((messagesData || []) as Message[]);

      if (shouldScrollToBottom) {
        setTimeout(() => scrollMessagesToBottom("auto"), 100);
      }
    } catch (error) {
      console.error("Unexpected loan page error:", error);
      toast.error("Stránku půjčky se nepodařilo načíst");
      setLoan(null);
    } finally {
      setLoading(false);
    }
  }

  async function addSystemMessage(text: string) {
    if (!userId) return;

    await supabase.from("loan_messages").insert({
      loan_id: loanId,
      sender_id: userId,
      is_system: true,
      message: text,
    });
  }

  async function approveLoan() {
    if (!loan) return;

    setSaving(true);

    const response = await fetch("/api/loans/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId: loan.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Půjčku se nepodařilo schválit");
      setSaving(false);
      return;
    }

    setLoan({ ...loan, status: "approved", approved_at: result.approvedAt });
    toast.success("Žádost schválena");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function rejectLoan() {
    if (!loan) return;

    setSaving(true);

    const response = await fetch("/api/loans/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId: loan.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Půjčku se nepodařilo odmítnout");
      setSaving(false);
      return;
    }

    setLoan({ ...loan, status: "cancelled" });
    toast.success("Žádost odmítnuta");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function markAsActive() {
    if (!loan) return;

    setSaving(true);

    const response = await fetch("/api/loans/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId: loan.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Předání se nepodařilo potvrdit");
      setSaving(false);
      return;
    }

    setLoan({ ...loan, status: "active", handed_over_at: result.handedOverAt });
    toast.success("Předání potvrzeno");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function markAsReturned() {
    if (!loan) return;

    setSaving(true);

    const response = await fetch("/api/loans/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId: loan.id }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Vrácení se nepodařilo potvrdit");
      setSaving(false);
      return;
    }

    setLoan({ ...loan, status: "returned", returned_at: result.returnedAt });
    toast.success("Vrácení potvrzeno");
    setSaving(false);
    scrollMessagesToBottom("smooth");
  }


  async function sendMessage() {
    if (!message.trim() || !loan || sendingMessage) return;

    setSendingMessage(true);

    const trimmedMessage = message.trim();

    const response = await fetch("/api/loans/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        loanId: loan.id,
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
    if (!loan || !userId || rating === 0) return;

    const reviewedUserId =
      loan.owner_id === userId ? loan.borrower_id : loan.owner_id;

    const { error } = await supabase.from("reviews").insert({
      loan_id: loan.id,
      item_id: loan.items?.id,
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

  if (!loan) {
    return (
      <main className="min-h-screen">
        <div className="koluj-shell">
          <p>Půjčka nebyla nalezena.</p>
        </div>
      </main>
    );
  }

  const isOwner = loan.owner_id === userId;
  const otherPersonLabel = isOwner ? "Zájemce" : "Vlastník";
  const otherPersonName = isOwner
    ? loan.borrower?.full_name || "Uživatel"
    : loan.owner?.full_name || "Uživatel";
  const otherPerson = isOwner ? loan.borrower : loan.owner;

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="mb-10">
          <BackLink href="/dashboard/loans">Půjčky</BackLink>
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
                    {isOwner ? "Zájemce o půjčení" : "Vlastník věci"}
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
              {loan.items?.primary_image_url && (
                <img
                  src={loan.items.primary_image_url}
                  alt={loan.items.title}
                  className="mb-5 h-56 w-full rounded-2xl object-cover"
                />
              )}

              <h1 className="text-3xl font-black">{loan.items?.title}</h1>

              <div className="mt-5 space-y-3 text-sm">
                <p><strong>Stav:</strong> {translateLoanStatus(loan.status)}</p>
                <p><strong>{otherPersonLabel}:</strong> {otherPersonName}</p>
                <p><strong>Vytvořeno:</strong> {formatDateTime(loan.created_at)}</p>

                {loan.approved_at && (
                  <p><strong>Schváleno:</strong> {formatDateTime(loan.approved_at)}</p>
                )}
                {loan.handed_over_at && (
                  <p><strong>Předáno:</strong> {formatDateTime(loan.handed_over_at)}</p>
                )}
                {loan.returned_at && (
                  <p><strong>Vráceno:</strong> {formatDateTime(loan.returned_at)}</p>
                )}

                <p><strong>Místo předání:</strong> {loan.items?.pickup_place}</p>
                <p>
                  <strong>Cena:</strong> {loan.items?.price_amount || 0} Kč
                  {loan.items?.price_unit
                    ? ` / ${translatePriceUnit(loan.items.price_unit)}`
                    : ""}
                </p>
                <p><strong>Kauce:</strong> {loan.items?.deposit || 0} Kč</p>
              </div>

              {isOwner && (
                <Link
                  href={`/dashboard/loans/${loan.id}/protocol`}
                  target="_blank"
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 font-black text-[var(--koluj-green)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Printer size={18} />
                  Vytisknout protokol o předání
                </Link>
              )}
            </div>
          </aside>

          <section className="koluj-card flex h-[740px] flex-col overflow-hidden">
            <div className="border-b border-[var(--koluj-border)] p-5">
              <h2 className="text-xl font-black">Domluva předání</h2>
              <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
                Stav: {translateLoanStatus(loan.status)}
              </p>
            </div>

            <div className="border-b border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-5">
              {isOwner && loan.status === "requested" && (
                <div>
                  <p className="mb-4 font-bold">Máš novou žádost o půjčení.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={approveLoan} disabled={saving} className="koluj-button py-3 disabled:opacity-60">
                      {saving ? "Ukládám..." : "Schválit žádost"}
                    </button>
                    <button type="button" onClick={rejectLoan} disabled={saving} className="rounded-2xl border border-red-200 bg-white py-3 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60">
                      Odmítnout žádost
                    </button>
                  </div>
                </div>
              )}

              {isOwner && loan.status === "approved" && (
                <div>
                  <p className="mb-4 font-bold">Žádost je schválená. Po předání věci potvrď předání.</p>
                  <button type="button" onClick={markAsActive} disabled={saving} className="koluj-button w-full py-3 disabled:opacity-60">
                    {saving ? "Ukládám..." : "Potvrdit předání"}
                  </button>
                </div>
              )}

              {isOwner && loan.status === "active" && (
                <div>
                  <p className="mb-4 font-bold">Půjčka probíhá. Po vrácení věci potvrď vrácení.</p>
                  <button type="button" onClick={markAsReturned} disabled={saving} className="koluj-button w-full py-3 disabled:opacity-60">
                    {saving ? "Ukládám..." : "Potvrdit vrácení"}
                  </button>
                </div>
              )}

              {loan.status === "returned" && !reviewSent && (
                <div>
                  <h3 className="font-black">Jak proběhla půjčka?</h3>
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
                    placeholder="Jak půjčka proběhla?"
                    className="koluj-input mt-4 min-h-[100px] w-full"
                  />

                  <button type="button" onClick={submitReview} className="koluj-button mt-4 w-full py-3">
                    Odeslat hodnocení
                  </button>
                </div>
              )}

              {loan.status === "returned" && reviewSent && (
                <p className="font-bold text-[var(--koluj-green)]">
                  Hodnocení už bylo odesláno.
                </p>
              )}

              {loan.status === "cancelled" && (
                <p className="font-bold text-[var(--koluj-muted)]">
                  Tato žádost byla zrušena.
                </p>
              )}

              {!isOwner &&
                loan.status !== "returned" &&
                loan.status !== "cancelled" && (
                  <p className="font-bold text-[var(--koluj-muted)]">
                    Další krok nyní potvrzuje vlastník věci.
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

            {loan.status === "returned" || loan.status === "cancelled" ? (
              <div className="border-t border-[var(--koluj-border)] p-4">
                <p className="text-center font-bold text-[var(--koluj-muted)]">
                  Chat je po ukončení půjčky uzamčen.
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