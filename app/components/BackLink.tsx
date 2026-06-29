import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function BackLink({ href, children, className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 pr-4 text-sm font-black text-[var(--koluj-text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)] transition group-hover:bg-[var(--koluj-green)] group-hover:text-white">
        <ArrowLeft size={16} />
      </span>
      <span>{children}</span>
    </Link>
  );
}
