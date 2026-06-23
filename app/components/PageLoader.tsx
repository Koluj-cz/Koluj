export default function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-[var(--koluj-border)] border-t-[var(--koluj-green)]" />

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--koluj-green)] text-sm font-black text-white">
          K
        </div>
      </div>
    </div>
  );
}