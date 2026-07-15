"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { FileText, Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/format";
import type { Message } from "./types";

type Props = {
  messages: Message[];
  userId: string | null;
  bookingStatus: string;
  isService: boolean;
  message: string;
  attachment: File | null;
  sending: boolean;
  onMessageChange: (value: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onSend: () => void;
};

const BookingChat = forwardRef<HTMLDivElement, Props>(function BookingChat(props, ref) {
  const locked = props.bookingStatus === "returned" || props.bookingStatus === "cancelled";
  return <>
    <div ref={ref} className="flex-1 overflow-y-auto p-5"><div className="space-y-4">{props.messages.map((msg) => <div key={msg.id} className={msg.is_system ? "rounded-2xl bg-[var(--koluj-bg)] p-4 text-sm whitespace-pre-line" : msg.sender_id === props.userId ? "ml-auto max-w-[75%] rounded-2xl bg-[var(--koluj-green)] p-4 text-white" : "max-w-[75%] rounded-2xl bg-[var(--koluj-bg)] p-4"}>
      {!msg.is_system && msg.sender_id !== props.userId && <p className="mb-1 text-xs font-bold opacity-70">{msg.profiles?.full_name || "Uživatel"}</p>}
      <p className="whitespace-pre-line">{msg.message}</p>
      {msg.attachment_url && msg.attachment_name && (msg.attachment_type?.startsWith("image/") ? <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-2xl bg-white/90"><Image src={msg.attachment_url} alt={msg.attachment_name} width={720} height={480} unoptimized className="max-h-72 w-full object-contain" /><span className="block truncate px-3 py-2 text-xs font-black text-[var(--koluj-text)]">{msg.attachment_name}</span></a> : <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-2xl bg-white/90 p-3 text-[var(--koluj-text)]"><FileText size={22} className="shrink-0 text-[var(--koluj-green)]" /><span className="min-w-0 truncate text-sm font-black">{msg.attachment_name}</span></a>)}
      <p className="mt-2 text-[11px] font-bold opacity-60">{formatDateTime(msg.created_at)}</p>
    </div>)}</div></div>

    {locked ? <div className="border-t border-[var(--koluj-border)] p-4"><p className="text-center font-bold text-[var(--koluj-muted)]">{props.isService ? "Chat je po ukončení služby uzamčen." : "Chat je po ukončení rezervace uzamčen."}</p></div> : <div className="border-t border-[var(--koluj-border)] p-4">
      {props.attachment && <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm"><span className="min-w-0 truncate font-bold">{props.attachment.name}</span><button type="button" onClick={() => props.onAttachmentChange(null)} className="shrink-0 text-red-600" aria-label="Odebrat přílohu"><X size={18} /></button></div>}
      <div className="flex gap-2 sm:gap-3"><label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-[var(--koluj-border)] bg-white text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]"><Paperclip size={20} /><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.zip" className="hidden" disabled={props.sending} onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 15 * 1024 * 1024) { toast.error("Příloha může mít maximálně 15 MB"); event.currentTarget.value = ""; return; } props.onAttachmentChange(file); event.currentTarget.value = ""; }} /></label>
        <input value={props.message} disabled={props.sending} onChange={(e) => props.onMessageChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !props.sending) props.onSend(); }} placeholder="Napiš zprávu..." className="koluj-input min-w-0 flex-1 disabled:opacity-60" />
        <button type="button" onClick={props.onSend} disabled={props.sending || (!props.message.trim() && !props.attachment)} className="koluj-button flex items-center justify-center px-4 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5">{props.sending ? <span className="text-sm font-black">...</span> : <Send size={18} />}</button>
      </div>
    </div>}
  </>;
});

export default BookingChat;
