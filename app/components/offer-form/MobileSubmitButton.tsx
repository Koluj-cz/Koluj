"use client";

import { Plus, Save } from "lucide-react";
import type { OfferFormMode } from "@/app/components/offer-form/types";

type MobileSubmitButtonProps = {
  mode: OfferFormMode;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export default function MobileSubmitButton({
  mode,
  isSubmitting,
  onSubmit,
}: MobileSubmitButtonProps) {
  const isNew = mode === "new";
  const ButtonIcon = isNew ? Plus : Save;

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="koluj-button w-full px-6 py-4 disabled:opacity-60"
      >
        <ButtonIcon size={18} />
        {isSubmitting ? "Ukládám..." : isNew ? "Přidat nabídku" : "Uložit změny"}
      </button>
    </div>
  );
}
