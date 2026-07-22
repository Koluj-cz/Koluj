export type ServiceRealizationDraft = {
  localId: string;
  title: string;
  description: string;
  indicativePriceFrom: string;
  files: File[];
  previews: string[];
};

export async function uploadServiceRealization(
  offerId: string,
  realization: ServiceRealizationDraft,
  sortOrder: number,
) {
  const formData = new FormData();
  formData.append("title", realization.title.trim());
  formData.append("description", realization.description.trim());
  formData.append("indicativePriceFrom", realization.indicativePriceFrom.trim());
  formData.append("sortOrder", String(sortOrder));
  realization.files.forEach((file) => formData.append("images", file));

  const response = await fetch(`/api/offers/${offerId}/realizations`, {
    method: "POST",
    body: formData,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "Realizaci se nepodařilo uložit");
  }
  return result;
}
