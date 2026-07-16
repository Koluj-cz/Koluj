import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
};

export default function BackLink({
  href,
  children,
  className = "",
  hideOnMobile = false,
}: BackLinkProps) {
  const responsiveClass = hideOnMobile ? "hidden md:inline-flex" : "";

  return (
    <Link
      href={href}
      className={`koluj-header-button ${responsiveClass} ${className}`}
    >
      <ArrowLeft size={17} />
      <span>{children}</span>
    </Link>
  );
}