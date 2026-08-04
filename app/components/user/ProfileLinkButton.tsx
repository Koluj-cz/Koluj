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
        compact ? "px-4 py-2 text-sm" : "px-5 py-3"
      } ${className}`}
    >
      <UserRound size={compact ? 16 : 18} />
      Zobrazit profil
    </Link>
  );
}
