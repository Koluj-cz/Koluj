export default function PageLoader() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">

        <div
          className="
            koluj-loader-ring
            absolute
            inset-0
            rounded-full
            border-[3px]
            border-transparent
            border-t-[var(--koluj-green)]
            border-r-[var(--koluj-green-soft)]
          "
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--koluj-green)] text-xl font-black text-white">
          K
        </div>

      </div>
    </div>
  );
}