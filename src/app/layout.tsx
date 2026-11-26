import type { Metadata } from "next";
import {
  Barlow_Condensed,
  Bebas_Neue,
  DM_Mono,
  Inter,
} from "next/font/google";
import "./globals.css";
import { buildThemeInitScript } from "@/lib/themes";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  weight: ["400", "600", "700", "800"],
  variable: "--font-condensed",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  variable: "--font-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://steamft.com";

const siteTitle = "SteamFamTrack — Steam Family Contribution & Swap Analyzer";
const siteDescription =
  "Track Steam Family game contributions, regional value shares, library overlaps, 1-year slot cooldowns, and waitlist swap simulations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | SteamFamTrack",
  },
  description: siteDescription,
  keywords: [
    "Steam Family Sharing",
    "Steam Family tracker",
    "Steam library overlap",
    "Steam slot cooldown",
    "waitlist swap simulator",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SteamFamTrack",
    title: siteTitle,
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="belteez-crimson"
      data-theme-mode="dark"
      data-theme-on-accent="light"
      suppressHydrationWarning
      className={`${bebasNeue.variable} ${barlowCondensed.variable} ${dmMono.variable} ${inter.variable} h-full dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bt-bg text-bt-ink antialiased selection:bg-bt-red selection:text-bt-on-accent">
        {children}
      </body>
    </html>
  );
}
