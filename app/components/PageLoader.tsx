export default function PageLoader() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Rotující kruh */}
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[var(--koluj-green-soft)] border-t-[var(--koluj-green)]" />

        {/* Logo */}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--koluj-green)] text-xl font-black text-white shadow-lg">
          K
        </div>
      </div>
    </div>
  );
}