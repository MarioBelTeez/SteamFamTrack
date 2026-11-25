import type { Metadata } from "next";
import {
  Barlow_Condensed,
  Bebas_Neue,
  DM_Mono,
  Inter,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "SteamFamTrack — Steam Family Contribution & Swap Analyzer",
  description:
    "Track Steam Family game contributions, regional value shares, library overlaps, 1-year slot cooldowns, and waitlist swap simulations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${barlowCondensed.variable} ${dmMono.variable} ${inter.variable} h-full dark`}
    >
      <body className="min-h-full flex flex-col bg-bt-bg text-white antialiased selection:bg-bt-red selection:text-white">
        {children}
      </body>
    </html>
  );
}
