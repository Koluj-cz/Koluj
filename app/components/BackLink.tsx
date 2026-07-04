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
      className={`inline-flex h-[52px] items-center gap-2 border border-[var(--koluj-border)] bg-white px-5 text-sm font-black text-[var(--koluj-green)] hover:border-[var(--koluj-green)] ${className}`}
    >
      <ArrowLeft size={17} />
      <span className="leading-none">{children}</span>
    </Link>
  );
}