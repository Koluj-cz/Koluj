type MediaProgressProps = {
  label: string;
  value: number;
};

export default function MediaProgress({ label, value }: MediaProgressProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="mt-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm font-bold text-[var(--koluj-muted)]">
        <span>{label}</span>
        <span>{safeValue} %</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-[var(--koluj-bg)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-[var(--koluj-green)] transition-[width] duration-300 ease-out"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
