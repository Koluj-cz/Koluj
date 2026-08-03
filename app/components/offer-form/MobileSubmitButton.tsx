"use client";

import { Plus, Save } from "lucide-react";
import MediaProgress from "@/app/components/offer-form/MediaProgress";
import type { OfferFormMode } from "@/app/components/offer-form/types";

type MobileSubmitButtonProps = {
  mode: OfferFormMode;
  isSubmitting: boolean;
  onSubmit: () => void;
  submitProgress?: number;
  submitProgressLabel?: string;
};

export default function MobileSubmitButton({
  mode,
  isSubmitting,
  onSubmit,
  submitProgress = 0,
  submitProgressLabel = "Ukládám nabídku...",
}: MobileSubmitButtonProps) {
  const isNew = mode === "new";
  const ButtonIcon = isNew ? Plus : Save;

  return (
    <div className="xl:hidden">
      {isSubmitting && <MediaProgress label={submitProgressLabel} value={submitProgress} />}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="koluj-button mt-4 w-full px-6 py-4 disabled:opacity-60"
      >
        <ButtonIcon size={18} />
        {isSubmitting ? "Ukládám..." : isNew ? "Přidat nabídku" : "Uložit změny"}
      </button>
    </div>
  );
}
