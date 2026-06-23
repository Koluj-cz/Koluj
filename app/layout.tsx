import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import CookieBanner from "@/app/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
});

export const metadata = {
  title: {
    default: "KOLUJ",
    template: "%s | KOLUJ",
  },
  description: "Půjčuj si věci od lidí ve svém okolí",
  manifest: "/manifest.webmanifest",
  themeColor: "#6b7f32",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KOLUJ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CookieBanner />
        <footer className="mt-auto border-t border-[var(--koluj-border)]">
          <div className="koluj-shell flex flex-col gap-4 py-8 text-sm text-[var(--koluj-muted)] md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} KOLUJ</p>

            <div className="flex flex-wrap gap-6">
              <a href="/legal/terms" className="hover:text-[var(--koluj-green)]">
                Podmínky
              </a>

              <a href="/legal/privacy" className="hover:text-[var(--koluj-green)]">
                Soukromí
              </a>

              <a href="/legal/cookies" className="hover:text-[var(--koluj-green)]">
                Cookies
              </a>

              <a
                href="mailto:info@koluj.cz"
                className="hover:text-[var(--koluj-green)]"
              >
                Kontakt
              </a>
            </div>
          </div>
        </footer>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}