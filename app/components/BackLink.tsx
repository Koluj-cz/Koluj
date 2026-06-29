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
      className={`
        group
        inline-flex
        items-center
        gap-3
        rounded-2xl
        bg-white
        px-3
        py-3
        pr-5
        text-base
        font-black
        text-[var(--koluj-text)]
        shadow-sm
        transition
        hover:-translate-y-0.5
        hover:shadow-md
        ${className}
      `}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)] transition-colors group-hover:bg-[var(--koluj-green)] group-hover:text-white">
        <ArrowLeft size={18} />
      </span>

      <span className="whitespace-nowrap leading-none">
        {children}
      </span>
    </Link>
  );
}