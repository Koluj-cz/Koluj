"use client";

type ConfirmLeaveDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

export default function ConfirmLeaveDialog({
  open,
  onStay,
  onLeave,
}: ConfirmLeaveDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex justify-center bg-black/30 px-4 pt-10 pb-28 sm:items-center sm:p-4">
      <div className="koluj-card mb-6 w-full max-w-lg p-6 shadow-2xl sm:mb-0">
        <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
          Neuložené změny
        </p>

        <h2 className="mt-2 text-2xl font-black text-[var(--koluj-ink)]">
          Chceš stránku opravdu opustit?
        </h2>

        <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
          Některé změny ještě nejsou uložené. Pokud odejdeš, rozepsané úpravy
          včetně nově přidaných fotek se zahodí.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onStay} className="koluj-button px-6 py-3">
            Zůstat na stránce
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="rounded-2xl border border-red-200 bg-white px-6 py-3 font-black text-red-600 hover:bg-red-50"
          >
            Odejít bez uložení
          </button>
        </div>
      </div>
    </div>
  );
}
