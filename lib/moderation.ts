import { supabase } from "@/lib/supabase";

const forbiddenPatterns = [
  /heil\s+hitler/i,
  /white\s+power/i,
  /kill\s+yourself/i,
];

const forbiddenWords = [
  // extremismus
  "nazi",
  "hitler",
  "heil hitler",
  "white power",
  "kkk",
  "ku klux klan",

  // rasismus
  "nigger",
  "nigga",
  "cikánská špína",
  "židovská špína",

  // pornografie
  "porno",
  "porn",
  "hardcore",
  "xxx",

  // sexuální služby
  "escort",
  "prostitutka",
  "prostituce",
  "sex za peníze",

  // násilí
  "zabiju tě",
  "chcípni",
  "kill yourself",

  // drogy
  "kokain",
  "pervitin",
  "heroin",
  "lsd",
  "mdma",

  // scam
  "bitcoin garantovaný zisk",
  "rychlé zbohatnutí",
];

export async function isEmailBlocked(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split("@")[1];

  const { data } = await supabase
    .from("email_blacklist")
    .select("id")
    .or(`email.eq.${normalizedEmail},domain.eq.${domain}`)
    .limit(1);

  return Boolean(data && data.length > 0);
}

export function containsForbiddenText(text: string) {
  const normalizedText = text.toLowerCase();

  return forbiddenWords.some((word) =>
    normalizedText.includes(word)
  );
}