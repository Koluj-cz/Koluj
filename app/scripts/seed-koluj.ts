import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const seedData: [string, string, string, string, number][] = [
  ["Milan Novák", "Tábor", "Vrtačka Bosch", "naradi", 120],
  ["Jana Dvořáková", "Sezimovo Ústí", "Čistič koberců Kärcher", "dum_zahrada", 250],
  ["Petr Svoboda", "Planá nad Lužnicí", "Stan pro 4 osoby", "outdoor", 180],
  ["Lucie Černá", "Soběslav", "Paddleboard", "sport", 300],
  ["Tomáš Procházka", "Tábor", "Aku šroubovák Makita", "naradi", 100],
  ["Eva Veselá", "Bechyně", "Projektor Epson", "elektronika", 350],
  ["Martin Kučera", "Tábor", "Žebřík hliníkový", "dum_zahrada", 90],
  ["Klára Horáková", "Chýnov", "Party stan 3x6 m", "party_akce", 400],
  ["David Marek", "Veselí nad Lužnicí", "Vysokotlaký čistič", "dum_zahrada", 220],
  ["Tereza Králová", "Tábor", "Fotoaparát Canon", "foto_video", 300],
    ["Radek Pokorný", "Tábor", "Skládací židle 6 ks", "dum_zahrada", 80],
    ["Monika Fialová", "Sezimovo Ústí", "Kempingový vařič", "outdoor", 90],
    ["Ondřej Němec", "Planá nad Lužnicí", "Bruska úhlová Makita", "naradi", 130],
    ["Barbora Malá", "Soběslav", "Dětská cyklosedačka", "sport", 100],
    ["Michal Urban", "Tábor", "Autonosič na kola", "auto_moto", 180],
    ["Veronika Kolářová", "Bechyně", "Šicí stroj Singer", "ostatni", 160],
    ["Filip Beneš", "Chýnov", "Reproduktor JBL PartyBox", "elektronika", 300],
    ["Alena Krátká", "Veselí nad Lužnicí", "Zahradní sekačka", "dum_zahrada", 250],
    ["Jiří Doležal", "Tábor", "Motorová pila", "dum_zahrada", 300],
    ["Nikola Veselá", "Tábor", "GoPro kamera", "foto_video", 220],
    ["Robert Čapek", "Sezimovo Ústí", "Přívěsný vozík", "auto_moto", 350],
    ["Lenka Šimková", "Planá nad Lužnicí", "Nafukovací matrace", "outdoor", 70],
    ["Václav Růžička", "Soběslav", "Míchadlo na maltu", "naradi", 150],
    ["Petra Havelková", "Tábor", "Kostýmový stojan", "party_akce", 120],
    ["Daniel Kříž", "Bechyně", "Tlakový postřikovač", "dum_zahrada", 80],
    ["Ivana Bartošová", "Chýnov", "Elektrický gril", "dum_zahrada", 180],
    ["Karel Matějka", "Veselí nad Lužnicí", "Laserový měřič vzdálenosti", "naradi", 110],
    ["Simona Vlčková", "Tábor", "Světla na focení", "foto_video", 200],
    ["Adam Pospíšil", "Sezimovo Ústí", "Střešní box", "auto_moto", 280],
    ["Hana Lišková", "Planá nad Lužnicí", "Sada nářadí v kufru", "naradi", 140],
] as const;

async function getOrCreateUser(email: string) {
  const { data: usersData, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    throw listError;
  }

  const existingUser = usersData.users.find((user) => user.email === email);

  if (existingUser) {
    return existingUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  "Tábor": { lat: 49.4144, lng: 14.6578 },
  "Sezimovo Ústí": { lat: 49.3852, lng: 14.6848 },
  "Planá nad Lužnicí": { lat: 49.3544, lng: 14.7011 },
  "Soběslav": { lat: 49.2599, lng: 14.7186 },
  "Bechyně": { lat: 49.2952, lng: 14.4681 },
  "Chýnov": { lat: 49.4069, lng: 14.8112 },
  "Veselí nad Lužnicí": { lat: 49.1843, lng: 14.6973 },
};

async function seed() {
  for (let index = 0; index < seedData.length; index++) {
    const [fullName, city, title, category, price] = seedData[index];

    const email = `seed${index + 1}@koluj.cz`;

    try {
      const user = await getOrCreateUser(email);
      const userId = user.id;

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
        city,
        bio: "Ukázkový profil pro první nabídku věcí v okolí.",
        is_verified: true,
        is_seed_user: true,
        email_notifications_enabled: true,
        push_notifications_enabled: false,
        marketing_notifications_enabled: false,
      });

      if (profileError) {
        console.error("Profile error:", fullName, profileError.message);
        continue;
      }

      const { data: existingItem } = await supabase
        .from("items")
        .select("id")
        .eq("owner_id", userId)
        .eq("title", title)
        .maybeSingle();

      if (existingItem) {
        console.log(`Skipped existing item: ${title}`);
        continue;
      }

    const coordinates =
    cityCoordinates[city] || cityCoordinates["Tábor"];

      const { error: itemError } = await supabase.from("items").insert({
        owner_id: userId,
        title,
        description: `${title} k půjčení v okolí. Vhodné pro krátkodobé použití.`,
        category,
        pickup_place: city,
        pickup_latitude: coordinates.lat,
        pickup_longitude: coordinates.lng,
        price_amount: price,
        price_unit: "day",
        deposit: 500,
        status: "available",
        is_active: true,
        availability_type: "long_term",
        condition: "good",
        is_seed_item: true,
      });

      if (itemError) {
        console.error("Item error:", title, itemError.message);
        continue;
      }

      console.log(`Created: ${fullName} – ${title}`);
    } catch (error) {
      console.error("Seed error:", email, error);
    }
  }

  console.log("Seed hotový.");
}

seed();