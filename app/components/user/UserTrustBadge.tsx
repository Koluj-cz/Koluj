import { Award, ShieldCheck } from "lucide-react";
import type { UserTrustLevel } from "@/lib/services/userTrustService";

type Props = {
  level: UserTrustLevel;
  compact?: boolean;
};

export default function UserTrustBadge({ level, compact = false }: Props) {
  if (level === "none") return null;

  const isTop = level === "top";
  const label = isTop ? "Top poskytovatel" : "Důvěryhodný poskytovatel";
  const Icon = isTop ? Award : ShieldCheck;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-black ${
        compact ? "text-xs" : "text-sm"
      } ${
        isTop
          ? "bg-violet-100 text-violet-800"
          : "bg-blue-100 text-blue-800"
      }`}
    >
      <Icon size={compact ? 14 : 16} />
      {label}
    </span>
  );
}
