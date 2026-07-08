import type { Metadata, Viewport } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.koluj.cz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Koluj – půjčuj si věci a služby v okolí",
    template: "%s | Koluj",
  },
  description: "Půjčuj si věci a objednávej služby od lidí ve svém okolí.",
  applicationName: "Koluj",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "Koluj",
    url: siteUrl,
    title: "Koluj – půjčuj si věci a služby v okolí",
    description: "Půjčuj si věci a objednávej služby od lidí ve svém okolí.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Koluj – půjčuj si věci a služby v okolí",
    description: "Půjčuj si věci a objednávej služby od lidí ve svém okolí.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koluj",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#16A34A",
};