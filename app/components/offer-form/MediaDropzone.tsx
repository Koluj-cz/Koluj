"use client";

import type { ReactNode } from "react";

type MediaDropzoneProps = {
  children: ReactNode;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  onFiles: (files: FileList | null) => void | Promise<void>;
};

export default function MediaDropzone({
  children,
  accept,
  multiple = false,
  disabled = false,
  className = "",
  onFiles,
}: MediaDropzoneProps) {
  return (
    <label
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-center text-[var(--koluj-green)] transition duration-200 hover:border-[var(--koluj-green)] hover:bg-[var(--koluj-bg)] focus-within:border-[var(--koluj-green)] focus-within:ring-4 focus-within:ring-[color:rgba(47,125,89,0.12)] ${
        disabled ? "pointer-events-none opacity-60" : ""
      } ${className}`}
    >
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          void onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />
    </label>
  );
}
