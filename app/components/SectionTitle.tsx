export default function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
          {icon}
        </div>
      )}
      <h2 className="text-2xl font-black">{title}</h2>
    </div>
  );
}