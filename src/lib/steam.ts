import { FamilyMemberInput, GameInfo, MemberLibrary, SteamRegion } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const APP_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const appDetailsCache = new Map<string, CacheEntry<Partial<GameInfo>>>();

const FAMILY_SHARING_CATEGORY_ID = 62;
const MAX_STORE_LOOKUPS_PER_RUN = 120;

export function parseSteamIdentifier(input: string): {
  type: "steamid64" | "vanity";
  value: string;
} {
  const trimmed = input.trim().replace(/\/+$/, "");

  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) {
    return { type: "steamid64", value: profileMatch[1] };
  }

  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (vanityMatch) {
    return { type: "vanity", value: vanityMatch[1] };
  }

  if (/^\d{17}$/.test(trimmed)) {
    return { type: "steamid64", value: trimmed };
  }

  return { type: "vanity", value: trimmed };
}

export async function resolveSteamId64(
  input: string,
  apiKey: string
): Promise<string> {
  const parsed = parseSteamIdentifier(input);
  if (parsed.type === "steamid64") {
    return parsed.value;
  }

  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(
    apiKey
  )}&vanityurl=${encodeURIComponent(parsed.value)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Steam ResolveVanityURL failed (${res.status})`);
  }
  const data = await res.json();
  if (data?.response?.success !== 1 || !data?.response?.steamid) {
    throw new Error(`Could not resolve Steam vanity URL "${parsed.value}"`);
  }
  return data.response.steamid as string;
}

async function fetchPlayerSummary(
  steamId64: string,
  apiKey: string
): Promise<{ personaName: string; avatarUrl: string; profileUrl: string }> {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(
    apiKey
  )}&steamids=${encodeURIComponent(steamId64)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Steam GetPlayerSummaries failed (${res.status})`);
  }
  const data = await res.json();
  const player = data?.response?.players?.[0];
  return {
    personaName: player?.personaname ?? steamId64,
    avatarUrl: player?.avatarfull ?? "",
    profileUrl:
      player?.profileurl ?? `https://steamcommunity.com/profiles/${steamId64}`,
  };
}

interface RawOwnedGame {
  appid: number;
  name?: string;
  img_icon_url?: string;
}

async function fetchOwnedGames(
  steamId64: string,
  apiKey: string
): Promise<RawOwnedGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(
    apiKey
  )}&steamid=${encodeURIComponent(
    steamId64
  )}&include_appinfo=1&include_played_free_games=0`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Steam GetOwnedGames failed (${res.status})`);
  }
  const data = await res.json();
  const games = data?.response?.games;
  if (!Array.isArray(games)) {
    throw new Error(
      `No games returned for ${steamId64}. Ensure Steam "Game details" is set to Public.`
    );
  }
  return games;
}

async function fetchAppDetails(
  appid: number,
  region: SteamRegion
): Promise<Partial<GameInfo>> {
  const cacheKey = `${appid}:${region}`;
  const cached = appDetailsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${region}&filters=price_overview,categories,is_free`;
    const res = await fetch(url);
    if (!res.ok) {
      return { rawPrice: 0, isFree: false, familySharingExcluded: false };
    }
    const json = await res.json();
    const entry = json?.[String(appid)];
    if (!entry?.success || !entry?.data) {
      return { rawPrice: 0, isFree: false, familySharingExcluded: false };
    }

    const data = entry.data;
    const isFree = Boolean(data.is_free);
    const initialCents: number = data.price_overview?.initial ?? 0;
    const rawPrice = isFree ? 0 : Math.round(initialCents) / 100;

    const categories: { id: number }[] = Array.isArray(data.categories)
      ? data.categories
      : [];
    const hasFamilySharing = categories.some(
      (c) => c.id === FAMILY_SHARING_CATEGORY_ID
    );
    // Paid games that lack category 62 are opted out of Steam Family Sharing
    const familySharingExcluded =
      !isFree && categories.length > 0 && !hasFamilySharing;

    const result: Partial<GameInfo> = {
      rawPrice,
      isFree,
      familySharingExcluded,
    };

    appDetailsCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + APP_CACHE_TTL_MS,
    });

    return result;
  } catch {
    return { rawPrice: 0, isFree: false, familySharingExcluded: false };
  }
}

export async function fetchMemberLibrariesLive(
  members: FamilyMemberInput[],
  region: SteamRegion,
  apiKey: string
): Promise<MemberLibrary[]> {
  const resolved = await Promise.all(
    members.map(async (member) => {
      const steamId64 = await resolveSteamId64(member.steamUrlOrId, apiKey);
      const [summary, owned] = await Promise.all([
        fetchPlayerSummary(steamId64, apiKey),
        fetchOwnedGames(steamId64, apiKey),
      ]);
      return { member, steamId64, summary, owned };
    })
  );

  // Deduplicate unique appids across all members before querying Steam Store
  const uniqueAppIds = new Set<number>();
  for (const r of resolved) {
    for (const g of r.owned) {
      uniqueAppIds.add(g.appid);
    }
  }

  const appIdsToFetch = Array.from(uniqueAppIds).slice(
    0,
    MAX_STORE_LOOKUPS_PER_RUN
  );

  const detailsMap = new Map<number, Partial<GameInfo>>();
  const BATCH_SIZE = 8;
  for (let i = 0; i < appIdsToFetch.length; i += BATCH_SIZE) {
    const batch = appIdsToFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (appid) => [appid, await fetchAppDetails(appid, region)] as const)
    );
    for (const [appid, info] of results) {
      detailsMap.set(appid, info);
    }
  }

  return resolved.map(({ member, steamId64, summary, owned }) => {
    let excludedCount = 0;
    const games: GameInfo[] = owned.map((g) => {
      const details = detailsMap.get(g.appid);
      const excluded = Boolean(details?.familySharingExcluded);
      if (excluded) excludedCount += 1;
      return {
        appid: g.appid,
        name: g.name ?? `App ${g.appid}`,
        rawPrice: details?.rawPrice ?? 0,
        isFree: details?.isFree ?? false,
        familySharingExcluded: excluded,
        headerImage: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
      };
    });

    return {
      member,
      steamId64,
      personaName: summary.personaName,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      games,
      excludedCount,
    };
  });
}
