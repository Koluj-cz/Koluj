"use client";

type StickySidebarProps = {
  children: React.ReactNode;
  className?: string;
  topClassName?: string;
};

export default function StickySidebar({
  children,
  className = "",
  topClassName = "xl:top-28",
}: StickySidebarProps) {
  return (
    <aside
      className={`hidden self-start xl:sticky xl:block ${topClassName} ${className}`}
    >
      {children}
    </aside>
  );
}
