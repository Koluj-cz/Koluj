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
        h-16
        items-center
        gap-4
        rounded-[32px]
        bg-white
        px-4
        pr-8
        text-xl
        font-black
        text-[var(--koluj-text)]
        shadow-[0_8px_24px_rgba(31,31,26,0.10)]
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:shadow-[0_12px_30px_rgba(31,31,26,0.14)]
        ${className}
      `}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] transition group-hover:bg-[var(--koluj-green)]">
        <ArrowLeft
          size={24}
          className="text-[var(--koluj-green)] transition group-hover:text-white"
        />
      </span>

      <span>{children}</span>
    </Link>
  );
}