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


export interface EnrichedStoreGame {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  isFree: boolean;
  familySharingSupported: boolean;
  discountPercent: number;
  initialFormatted: string;
  finalFormatted: string;
  finalPriceCents: number;
}

export interface FamilyWishlistGame extends EnrichedStoreGame {
  wishedBy: Array<{ memberId: string; name: string; steamId64: string }>;
  wishCount: number;
}

const DISCOUNTS_CACHE_TTL_MS = 15 * 60 * 1000;
const discountsCache = new Map<
  SteamRegion,
  { items: EnrichedStoreGame[]; expiresAt: number }
>();

export async function fetchStoreBrowseItems(
  appids: number[],
  region: SteamRegion
): Promise<Map<number, EnrichedStoreGame>> {
  const uniqueIds = Array.from(new Set(appids.filter((id) => id > 0))).slice(
    0,
    80
  );
  const result = new Map<number, EnrichedStoreGame>();
  if (uniqueIds.length === 0) return result;

  const cc = REGION_TO_COUNTRY_CODE[region] ?? "US";
  const inputJson = JSON.stringify({
    ids: uniqueIds.map((appid) => ({ appid })),
    context: {
      language: "english",
      country_code: cc,
      steam_realm: 1,
    },
    data_request: {
      include_basic_info: true,
      include_assets: true,
    },
  });

  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(
    inputJson
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Steam StoreBrowse failed (${res.status})`);
  }

  const json = (await res.json()) as {
    response?: {
      store_items?: Array<{
        appid?: number;
        id?: number;
        name?: string;
        is_free?: boolean | null;
        best_purchase_option?: {
          discount_pct?: number;
          formatted_original_price?: string;
          formatted_final_price?: string;
          final_price_in_cents?: string | number;
        } | null;
        categories?: {
          feature_categoryids?: number[];
          supported_player_categoryids?: number[];
          controller_categoryids?: number[];
        } | null;
        assets?: {
          asset_url_format?: string;
          header?: string;
        } | null;
      }>;
    };
  };

  for (const item of json.response?.store_items ?? []) {
    const appid = Number(item.appid ?? item.id);
    if (!Number.isFinite(appid) || appid <= 0) continue;

    const isFree = Boolean(item.is_free);
    const cats = [
      ...(item.categories?.feature_categoryids ?? []),
      ...(item.categories?.supported_player_categoryids ?? []),
      ...(item.categories?.controller_categoryids ?? []),
    ];
    const familySharingSupported =
      !isFree && cats.includes(FAMILY_SHARING_CATEGORY_ID);

    const format = item.assets?.asset_url_format;
    const header = item.assets?.header;
    const headerImage =
      format && header
        ? `https://shared.fastly.steamstatic.com/store_item_assets/${format.replace(
            "${FILENAME}",
            header
          )}`
        : `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;

    const po = item.best_purchase_option;
    const finalPriceCents = Number(po?.final_price_in_cents ?? 0) || 0;

    result.set(appid, {
      appid,
      name: item.name || `App ${appid}`,
      headerImage,
      storeUrl: `https://store.steampowered.com/app/${appid}/`,
      isFree,
      familySharingSupported,
      discountPercent: Number(po?.discount_pct ?? 0) || 0,
      initialFormatted: po?.formatted_original_price || "",
      finalFormatted: isFree ? "Free" : po?.formatted_final_price || "",
      finalPriceCents,
    });
  }

  return result;
}

export async function getPopularSteamDiscounts(
  region: SteamRegion
): Promise<EnrichedStoreGame[]> {
  const cached = discountsCache.get(region);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const cc = REGION_TO_COUNTRY_CODE[region] ?? "US";
  let appids: number[] = [];

  try {
    const searchUrl = `https://store.steampowered.com/search/results/?specials=1&filter=topsellers&json=1&cc=${cc}`;
    const res = await fetch(searchUrl, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        items?: Array<{ name?: string; logo?: string }>;
      };
      appids = (data.items ?? [])
        .map((it) => {
          const match = it.logo?.match(/\/apps\/(\d+)\//i);
          return match ? Number(match[1]) : 0;
        })
        .filter((id) => id > 0);
    }
  } catch {
    // Fallback below
  }

  if (appids.length === 0) {
    const fcUrl = `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`;
    const fcRes = await fetch(fcUrl, { cache: "no-store" });
    if (fcRes.ok) {
      const fc = (await fcRes.json()) as {
        specials?: { items?: Array<{ id?: number }> };
      };
      appids = (fc.specials?.items ?? [])
        .map((it) => Number(it.id ?? 0))
        .filter((id) => id > 0);
    }
  }

  const enrichedMap = await fetchStoreBrowseItems(appids.slice(0, 48), region);
  const items = appids
    .map((id) => enrichedMap.get(id))
    .filter(
      (item): item is EnrichedStoreGame =>
        Boolean(item) && (item!.discountPercent > 0 || Boolean(item!.finalFormatted))
    );

  discountsCache.set(region, {
    items,
    expiresAt: Date.now() + DISCOUNTS_CACHE_TTL_MS,
  });

  return items;
}

export async function getFamilyWishlists(opts: {
  members: Array<{ memberId: string; name: string; steamId64: string }>;
  region: SteamRegion;
}): Promise<{ items: FamilyWishlistGame[]; privateMembers: string[] }> {
  const privateMembers: string[] = [];
  const wishMap = new Map<
    number,
    {
      wishedBy: Array<{ memberId: string; name: string; steamId64: string }>;
      minPriority: number;
    }
  >();

  const settled = await Promise.allSettled(
    opts.members.map(async (member) => {
      const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${encodeURIComponent(
        member.steamId64
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        response?: {
          items?: Array<{ appid?: number; priority?: number }>;
        };
      };
      return {
        member,
        items: data.response?.items ?? [],
      };
    })
  );

  settled.forEach((outcome, idx) => {
    const member = opts.members[idx];
    if (outcome.status !== "fulfilled" || outcome.value.items.length === 0) {
      privateMembers.push(member.name);
      return;
    }

    for (const item of outcome.value.items) {
      const appid = Number(item.appid ?? 0);
      if (!appid) continue;
      const existing = wishMap.get(appid) ?? {
        wishedBy: [],
        minPriority: 9999,
      };
      if (!existing.wishedBy.some((w) => w.steamId64 === member.steamId64)) {
        existing.wishedBy.push(member);
      }
      const prio = Number(item.priority ?? 999);
      if (prio > 0 && prio < existing.minPriority) {
        existing.minPriority = prio;
      }
      wishMap.set(appid, existing);
    }
  });

  const sortedAppIds = Array.from(wishMap.entries())
    .sort(
      (a, b) =>
        b[1].wishedBy.length - a[1].wishedBy.length ||
        a[1].minPriority - b[1].minPriority
    )
    .slice(0, 48)
    .map(([appid]) => appid);

  const enrichedMap = await fetchStoreBrowseItems(sortedAppIds, opts.region);
  const items: FamilyWishlistGame[] = [];

  for (const appid of sortedAppIds) {
    const store = enrichedMap.get(appid);
    const wish = wishMap.get(appid);
    if (!store || !wish) continue;
    items.push({
      ...store,
      wishedBy: wish.wishedBy,
      wishCount: wish.wishedBy.length,
    });
  }

  return { items, privateMembers };
}
