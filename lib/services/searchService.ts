export type SearchableOffer = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  pickup_place?: string | null;
};

const STOP_WORDS = new Set([
  "a",
  "aku",
  "aby",
  "ale",
  "asi",
  "by",
  "bych",
  "bychom",
  "bylo",
  "byla",
  "byly",
  "co",
  "do",
  "ho",
  "hledam",
  "hledame",
  "hledat",
  "chci",
  "chtel",
  "chtela",
  "chteli",
  "ja",
  "jak",
  "jaky",
  "jakou",
  "je",
  "jeden",
  "jednu",
  "k",
  "kde",
  "mi",
  "mohl",
  "mohla",
  "muzete",
  "na",
  "nejaky",
  "nejakou",
  "neco",
  "nemate",
  "od",
  "po",
  "potrebuji",
  "potreboval",
  "potrebovala",
  "pro",
  "prosim",
  "pujcit",
  "se",
  "shanim",
  "shanime",
  "si",
  "s",
  "to",
  "u",
  "v",
  "ve",
  "z",
  "za",
  "ze",
]);

/**
 * Skupiny běžných českých tvarů a synonym. První výraz je kanonický tvar,
 * ostatní tvary slouží pro rozpoznání dotazu i pro serverové vyhledávání.
 */
const SEARCH_ALIAS_GROUPS = [
  ["vrtačka", "vrtačku", "vrtačky", "vrtacka", "vrtacku", "vrtacky", "aku vrtačka", "aku vrtacka", "vrták", "vrtak"],
  ["žebřík", "žebříku", "žebříky", "zebrik", "zebriku", "zebriky", "štafle", "stafle", "schůdky", "schudky"],
  ["sekačka", "sekačku", "sekačky", "sekacka", "sekacku", "sekacky", "posekat", "sekání", "sekani"],
  ["křovinořez", "křovinořezu", "křovinořezy", "krovinorez", "krovinorezu", "krovinorezy"],
  ["pila", "pilu", "pily", "motorová pila", "motorovou pilu", "motorova pila", "motorovou pilu"],
  ["vozík", "vozíku", "vozíky", "vozik", "voziku", "voziky", "přívěs", "prives", "přívěsný vozík", "privesny vozik"],
  ["rudl", "rudlu", "rudly", "kára", "kara", "stěhovací vozík", "stehovaci vozik"],
  ["bruska", "brusku", "brusky"],
  ["kladivo", "kladiva", "bourací kladivo", "bouraci kladivo"],
  ["svářečka", "svářečku", "svářečky", "svarecka", "svarecku", "svarecky"],
  ["čistič", "čističe", "cistic", "cistice", "wapka", "vysokotlaký čistič", "vysokotlaky cistic"],
  ["malíř", "malíře", "maliri", "malir", "malire", "malování", "malovani", "vymalovat", "natřít", "natrit"],
  ["stěhování", "stehovani", "přestěhovat", "prestehovat", "stěhovák", "stehovak"],
  ["elektrikář", "elektrikáře", "elektrikar", "elektrikare"],
  ["instalatér", "instalatéra", "instalater", "instalatera"],
  ["truhlář", "truhláře", "truhlar", "truhlare", "tesař", "tesaře", "tesar", "tesare"],
  ["úklid", "uklid", "uklízení", "uklizeni", "uklidit"],
  ["kolo", "kola", "kolu", "bicykl", "bicyklu"],
  ["stan", "stanu", "stany", "kempování", "kempovani"],
  ["gril", "grilu", "grily", "grilování", "grilovani", "grilovačka", "grilovacka"],
] as const;

const NORMALIZED_ALIAS_TO_GROUP = new Map<string, readonly string[]>();
for (const group of SEARCH_ALIAS_GROUPS) {
  for (const alias of group) {
    NORMALIZED_ALIAS_TO_GROUP.set(normalizeSearchText(alias), group);
  }
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(rawQuery: string) {
  return normalizeSearchText(rawQuery)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function getAliasGroup(tokenOrPhrase: string) {
  return NORMALIZED_ALIAS_TO_GROUP.get(normalizeSearchText(tokenOrPhrase));
}

function getComparableRoots(value: string) {
  const normalized = normalizeSearchText(value);
  if (normalized.length < 5) return [normalized];

  const roots = new Set([normalized]);
  const suffixes = ["ami", "emi", "ove", "ovi", "ach", "ich", "ech", "em", "ou", "u", "y", "i", "a", "e"];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 4) {
      roots.add(normalized.slice(0, -suffix.length));
    }
  }
  return [...roots];
}

export function getSearchTokens(rawQuery: string) {
  const rawTokens = meaningfulTokens(rawQuery);
  const canonicalTokens: string[] = [];

  for (const token of rawTokens) {
    const group = getAliasGroup(token);
    canonicalTokens.push(normalizeSearchText(group?.[0] || token));
  }

  return [...new Set(canonicalTokens)];
}

export function getCleanSearchQuery(rawQuery: string) {
  return getSearchTokens(rawQuery).join(" ");
}

export function matchesSearchQuery(
  searchable: SearchableOffer | string,
  rawQuery: string,
) {
  const tokens = getSearchTokens(rawQuery);
  if (!tokens.length) return true;

  const source =
    typeof searchable === "string"
      ? searchable
      : [
          searchable.title,
          searchable.description,
          searchable.category,
          searchable.pickup_place,
        ]
          .filter(Boolean)
          .join(" ");

  const normalizedSource = normalizeSearchText(source);
  const sourceWords = normalizedSource.split(" ").filter(Boolean);

  const matchedTokenCount = tokens.filter((token) => {
    const aliasGroup = getAliasGroup(token);
    const candidates = aliasGroup?.map(normalizeSearchText) || [token];

    return candidates.some((candidate) => {
      if (normalizedSource.includes(candidate)) return true;

      const candidateRoots = getComparableRoots(candidate);
      return sourceWords.some((word) => {
        const wordRoots = getComparableRoots(word);
        return candidateRoots.some((candidateRoot) =>
          wordRoots.some(
            (wordRoot) =>
              candidateRoot.length >= 4 &&
              wordRoot.length >= 4 &&
              (wordRoot.startsWith(candidateRoot) || candidateRoot.startsWith(wordRoot)),
          ),
        );
      });
    });
  }).length;

  // U přirozených vět stačí shoda většiny významových slov. Tím například
  // „chci vymalovat pokoj“ najde malířské nabídky, i když v nich není slovo pokoj.
  const requiredMatches = Math.max(1, Math.ceil(tokens.length * 0.5));
  return matchedTokenCount >= requiredMatches;
}

/**
 * Vrací bezpečné výrazy pro PostgREST `ilike`. Obsahuje původní české tvary,
 * kanonické tvary i významovou frázi bez konverzačních slov.
 */
export function buildServerSearchTerms(rawQuery: string) {
  const tokens = meaningfulTokens(rawQuery);
  if (!tokens.length) return [];

  const terms = new Set<string>();
  const cleanedPhrase = tokens.join(" ").trim();
  if (cleanedPhrase.length >= 2) terms.add(cleanedPhrase);

  for (const token of tokens) {
    const group = getAliasGroup(token);
    if (group) {
      for (const alias of group) terms.add(alias);
    } else {
      terms.add(token);
    }
  }

  return [...terms]
    .map((term) => term.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 24);
}
