import { Toaster } from "react-hot-toast";
import "./globals.css";
import CookieBanner from "@/app/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import UserPresence from "@/app/components/UserPresence";
import BottomNav from "@/app/components/BottomNav";
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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <UserPresence />
        {children}
        <CookieBanner />
        <BottomNav />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "18px",
              border: "1px solid rgba(50,43,26,0.10)",
              boxShadow: "0 16px 48px rgba(40,42,30,0.14)",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}