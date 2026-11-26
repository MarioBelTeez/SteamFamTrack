export interface SeoFaqItem {
  question: string;
  answer: string;
}

export const STEAM_FAMILY_FAQ: SeoFaqItem[] = [
  {
    question: "How does SteamFamTrack track Steam Family game contributions?",
    answer:
      "SteamFamTrack reads public Steam libraries via the official Steam Web API, checks which titles support Steam Family Sharing (Store Category 62), deduplicates overlapping games across all 6 members, and calculates each player's exclusive games, shared games, regional store value, and Fairness Meter score.",
  },
  {
    question: "Can I check if a Steam game supports Family Sharing before buying it?",
    answer:
      "Yes. SteamFamTrack's Game & Discount Checker (and the SteamFT Discord Bot's /check command) verifies live Steam regional pricing, active discounts, Category 62 Steam Family Sharing eligibility, and which family members already own the game.",
  },
  {
    question: "How does the Steam Family 1-year slot cooldown work?",
    answer:
      "When an adult leaves a Steam Family, their seat stays locked for 1 full year from the date they originally joined — not from the date they left. Enter each member's join date in SteamFamTrack to track exact slot unlock dates and simulate swaps before changing seats.",
  },
  {
    question: "Why are some owned Steam games excluded from our family library?",
    answer:
      "Publishers can opt individual titles out of Steam Family Sharing (typically games requiring third-party launchers or subscriptions). SteamFamTrack detects Steam Store Category 62 and excludes non-shareable titles by default so your shared catalog count and value stay accurate.",
  },
  {
    question: "How do we split 7 to 12 friends fairly into two Steam Families?",
    answer:
      "Add up to 6 active members and up to 6 waitlist friends, then use the Multi-Swap Simulator & 2-Family Fair Splitter to automatically balance two Steam Families by Equal Games, Equal Value, or Stacked Main + B-Team.",
  },
  {
    question: "Is SteamFamTrack safe and free to use?",
    answer:
      "Yes. SteamFamTrack is free and open-source (AGPL-3.0). Preview Mode works with zero sign-in, and optional account sign-in uses official Steam OpenID 2.0 on steamcommunity.com — SteamFamTrack never sees your Steam password or writes to your Steam account.",
  },
];

export function buildStructuredDataJsonLd(siteUrl: string) {
  const normalizedUrl = siteUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "SteamFamTrack",
        alternateName: "SteamFT",
        url: normalizedUrl,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        license: "https://www.gnu.org/licenses/agpl-3.0.en.html",
        description:
          "Free Steam Family tracker, Steam Family Share checker (Category 62), library overlap analyzer, 1-year slot cooldown calculator, 2-family splitter, and Discord bot.",
        creator: {
          "@type": "Organization",
          name: "BelTeez Studio",
          url: "https://belteez.studio",
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: STEAM_FAMILY_FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}
