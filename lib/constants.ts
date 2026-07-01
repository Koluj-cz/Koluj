
export const offerTypeLabels: Record<string, string> = {
  item: "Nabídka",
  service: "Služba",
};

export const offerTypes = ["item", "service"] as const;

export const serviceCategoryLabels: Record<string, string> = {
  remesla: "Řemesla",
  domacnost: "Domácnost",
  zahrada: "Zahrada",
  stehovani: "Stěhování",
  doucovani: "Doučování",
  it: "IT a technika",
  hlidani: "Hlídání",
  ostatni_sluzby: "Ostatní služby",
};

export const serviceCategories = [
  "remesla",
  "domacnost",
  "zahrada",
  "stehovani",
  "doucovani",
  "it",
  "hlidani",
  "ostatni_sluzby",
] as const;

export const categoryLabels: Record<string, string> = {
  naradi: "Nářadí",
  elektronika: "Elektronika",
  sport: "Sport",
  outdoor: "Outdoor",
  dum_zahrada: "Dům a zahrada",
  auto_moto: "Auto/Moto",
  foto_video: "Foto a video",
  party_akce: "Party a akce",
  ostatni: "Ostatní",
};

export const categories = [
  "naradi",
  "elektronika",
  "sport",
  "outdoor",
  "dum_zahrada",
  "auto_moto",
  "foto_video",
  "party_akce",
  "ostatni",
] as const;

export const conditionLabels: Record<string, string> = {
  new: "Nové",
  like_new: "Jako nové",
  good: "Dobrý stav",
  used: "Běžně používané",
};

export const conditions = [
  "new",
  "like_new",
  "good",
  "used",
] as const;

export const itemStatusLabels: Record<string, string> = {
  available: "Volné",
  reserved: "Rezervované",
  borrowed: "Půjčené",
};

export const itemStatuses = [
  "available",
  "reserved",
  "borrowed",
] as const;

export const itemStatusClasses: Record<string, string> = {
  available: "koluj-status-available",
  reserved: "koluj-status-reserved",
  borrowed: "koluj-status-borrowed",
};

export const handoverLabels: Record<string, string> = {
  pracovni_dny: "Pracovní dny",
  vecer_po_praci: "Večer po práci",
  vikendy: "Víkendy",
  kdykoliv: "Kdykoliv",
};

export const handoverOptions = [
  "pracovni_dny",
  "vecer_po_praci",
  "vikendy",
  "kdykoliv",
] as const;

export const loanStatusLabels: Record<string, string> = {
  all: "Vše",
  requested: "Čeká na schválení",
  approved: "Schváleno",
  active: "Probíhá",
  returned: "Vráceno",
  cancelled: "Zrušeno",
};

export const loanStatusClasses: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  active: "bg-[var(--koluj-green)] text-white",
  returned: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};
