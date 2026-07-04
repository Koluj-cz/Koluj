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
    <Link href={href} className={`koluj-header-button ${className}`}>
      <ArrowLeft size={17} />
      <span>{children}</span>
    </Link>
  );
}