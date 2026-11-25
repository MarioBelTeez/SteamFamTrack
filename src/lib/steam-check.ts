import type { SteamRegion } from "./types";

const REGION_TO_COUNTRY_CODE: Record<SteamRegion, string> = {
  ma: "MA",
  us: "US",
  eu: "DE",
  gb: "GB",
  br: "BR",
  jp: "JP",
};

const FAMILY_SHARING_CATEGORY_ID = 62;

export interface GameSearchAlternative {
  appid: number;
  name: string;
  tinyImage?: string;
}

export interface GamePriceOverview {
  currency: string;
  initial: number;
  final: number;
  discountPercent: number;
  initialFormatted: string;
  finalFormatted: string;
}

export interface SteamGameCheckResult {
  appid: number;
  name: string;
  type: string;
  headerImage: string;
  storeUrl: string;
  region: SteamRegion;
  isFree: boolean;
  familySharingSupported: boolean;
  familySharingNote: string;
  priceOverview: GamePriceOverview | null;
  alternatives: GameSearchAlternative[];
}

export function parseGameQuery(input: string):
  | { type: "appid"; appid: number }
  | { type: "search"; term: string } {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/store\.steampowered\.com\/app\/(\d+)/i);
  if (urlMatch) {
    return { type: "appid", appid: Number(urlMatch[1]) };
  }
  if (/^\d{1,10}$/.test(trimmed)) {
    return { type: "appid", appid: Number(trimmed) };
  }
  return { type: "search", term: trimmed };
}

export async function searchSteamStore(
  term: string,
  region: SteamRegion
): Promise<GameSearchAlternative[]> {
  const cc = REGION_TO_COUNTRY_CODE[region] ?? "US";
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
    term
  )}&l=english&cc=${cc}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Steam Store search failed (${res.status})`);
  }

  const data = (await res.json()) as {
    items?: Array<{ id?: number; name?: string; tiny_image?: string }>;
  };

  return (data.items ?? [])
    .filter((item) => typeof item.id === "number" && typeof item.name === "string")
    .slice(0, 6)
    .map((item) => ({
      appid: item.id!,
      name: item.name!,
      tinyImage: item.tiny_image,
    }));
}

export async function checkSteamGame(opts: {
  query: string;
  region: SteamRegion;
}): Promise<SteamGameCheckResult | null> {
  const parsed = parseGameQuery(opts.query);
  const cc = REGION_TO_COUNTRY_CODE[opts.region] ?? "US";

  let appid: number;
  let alternatives: GameSearchAlternative[] = [];

  if (parsed.type === "appid") {
    appid = parsed.appid;
  } else {
    if (!parsed.term) return null;
    alternatives = await searchSteamStore(parsed.term, opts.region);
    if (alternatives.length === 0) return null;
    appid = alternatives[0].appid;
  }

  const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${cc}&l=english`;
  const res = await fetch(detailsUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Steam appdetails failed (${res.status})`);
  }

  const json = (await res.json()) as Record<
    string,
    {
      success?: boolean;
      data?: {
        steam_appid?: number;
        name?: string;
        type?: string;
        is_free?: boolean;
        header_image?: string;
        categories?: Array<{ id?: number; description?: string }>;
        price_overview?: {
          currency?: string;
          initial?: number;
          final?: number;
          discount_percent?: number;
          initial_formatted?: string;
          final_formatted?: string;
        };
      };
    }
  >;

  const entry = json[String(appid)];
  if (!entry?.success || !entry.data) {
    return null;
  }

  const d = entry.data;
  const isFree = Boolean(d.is_free);
  const hasCat62 =
    Array.isArray(d.categories) &&
    d.categories.some((c) => c.id === FAMILY_SHARING_CATEGORY_ID);

  const familySharingSupported = !isFree && hasCat62;
  const familySharingNote = isFree
    ? "Free-to-play — doesn't use Family Sharing (anyone can claim it free)."
    : hasCat62
      ? "Supports Steam Family Sharing (Category 62)."
      : "Excluded from Steam Family Sharing (publisher opted out).";

  const po = d.price_overview;
  const priceOverview: GamePriceOverview | null = po
    ? {
        currency: po.currency || "USD",
        initial: typeof po.initial === "number" ? po.initial / 100 : 0,
        final: typeof po.final === "number" ? po.final / 100 : 0,
        discountPercent:
          typeof po.discount_percent === "number" ? po.discount_percent : 0,
        initialFormatted: po.initial_formatted || "",
        finalFormatted: po.final_formatted || "",
      }
    : null;

  return {
    appid: d.steam_appid ?? appid,
    name: d.name || `App ${appid}`,
    type: d.type || "game",
    headerImage:
      d.header_image ||
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
    storeUrl: `https://store.steampowered.com/app/${appid}/`,
    region: opts.region,
    isFree,
    familySharingSupported,
    familySharingNote,
    priceOverview,
    alternatives,
  };
}
