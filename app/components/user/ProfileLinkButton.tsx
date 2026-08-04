import Link from "next/link";
import { UserRound } from "lucide-react";

type Props = {
  userId: string;
  className?: string;
  compact?: boolean;
};

export default function ProfileLinkButton({
  userId,
  className = "",
  compact = false,
}: Props) {
  return (
    <Link
      href={`/users/${userId}`}
      className={`koluj-button inline-flex items-center justify-center gap-2 text-center ${
        compact ? "h-12 min-h-12 px-4 text-sm" : "h-12 min-h-12 px-5"
      } ${className}`}
    >
      <UserRound size={compact ? 16 : 18} />
      Zobrazit profil
    </Link>
  );
}
