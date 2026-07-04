import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function BackLink({
  href,
  children,
  className = "",
}: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex h-[52px] items-center gap-2 rounded-2xl border border-[var(--koluj-border)] bg-white px-5 font-bold text-[var(--koluj-text)] shadow-sm transition-all hover:border-[var(--koluj-green)] hover:text-[var(--koluj-green)] hover:shadow-md ${className}`}
    >
      <ArrowLeft size={18} />
      <span>{children}</span>
    </Link>
  );
}