import { Toaster } from "react-hot-toast";
import "./globals.css";
import CookieBanner from "@/app/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import UserPresence from "@/app/components/UserPresence";
import BottomNav from "@/app/components/BottomNav";

export const metadata = {
  title: {
    default: "Koluj",
    template: "%s | Koluj",
  },
  description: "Půjčuj si věci a objednávej služby od lidí ve svém okolí",
  manifest: "/manifest.webmanifest",
  themeColor: "#5f7f2b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koluj",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
