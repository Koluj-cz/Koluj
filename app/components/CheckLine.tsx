import { Check } from "lucide-react";

export default function CheckLine({
  done,
  text,
}: {
  done: boolean;
  text: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          done
            ? "bg-[var(--koluj-green)] text-white"
            : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
        }`}
      >
        {done ? <Check size={14} /> : ""}
      </span>
      {text}
    </li>
  );
}