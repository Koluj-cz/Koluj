import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = { href: string; children: React.ReactNode; className?: string };

export default function BackLink({ href, children, className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/76 px-3 py-2 pr-5 text-base font-black text-[var(--koluj-text)] shadow-[0_10px_28px_rgba(40,42,30,0.08)] backdrop-blur hover:bg-white hover:shadow-[0_16px_38px_rgba(40,42,30,0.12)] md:text-lg ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--koluj-green-soft)] text-[var(--koluj-green)] group-hover:bg-[var(--koluj-green)] group-hover:text-white">
        <ArrowLeft size={16} />
      </span>
      <span className="whitespace-nowrap leading-none">{children}</span>
    </Link>
  );
}
