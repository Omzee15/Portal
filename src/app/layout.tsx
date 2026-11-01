import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Silkscreen } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

/** Moves data saved under the old "pastime:" keys to "portal:" before anything reads it, so no one loses streaks or notes. */
const MIGRATE_STORAGE = `(function(){try{var ks=Object.keys(localStorage);for(var i=0;i<ks.length;i++){var k=ks[i];if(k.indexOf("pastime:")===0){var n="portal:"+k.slice(8);if(localStorage.getItem(n)===null){localStorage.setItem(n,localStorage.getItem(k));}localStorage.removeItem(k);}}}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Portal", template: "%s · Portal" },
  openGraph: { title: "Portal", description: "Your portal for all games: daily puzzles, live party games and a journal that writes itself.", type: "website" },
  description: "Your portal for all games: daily puzzles, live party games and a journal that writes itself.",
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f2eadb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${silkscreen.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MIGRATE_STORAGE }} />
      </head>
      <body className="min-h-dvh">
        <SiteHeader />
        <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-paper md:min-h-[calc(100dvh-4rem)] md:max-w-5xl md:bg-transparent">
          {children}
        </div>
        <SiteFooter />
        <RegisterSW />
      </body>
    </html>
  );
}
