import { Toaster } from "react-hot-toast";
import "./globals.css";
import CookieBanner from "@/app/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import UserPresence from "@/app/components/UserPresence";
import BottomNav from "@/app/components/BottomNav";

export const metadata = {
  title: {
    default: "KOLUJ",
    template: "%s | KOLUJ",
  },
  description: "Půjčuj si věci a objednávej služby od lidí ve svém okolí",
  manifest: "/manifest.webmanifest",
  themeColor: "#5f7f2b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KOLUJ",
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
        <footer className="mt-auto hidden md:block">
          <div className="koluj-shell flex flex-col gap-4 py-8 text-sm text-[var(--koluj-muted)] md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} KOLUJ</p>
            <div className="flex flex-wrap gap-6 font-bold">
              <a href="/legal/terms" className="hover:text-[var(--koluj-green)]">Podmínky</a>
              <a href="/legal/privacy" className="hover:text-[var(--koluj-green)]">Soukromí</a>
              <a href="/legal/cookies" className="hover:text-[var(--koluj-green)]">Cookies</a>
              <a href="mailto:info@koluj.cz" className="hover:text-[var(--koluj-green)]">Kontakt</a>
            </div>
          </div>
        </footer>
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
