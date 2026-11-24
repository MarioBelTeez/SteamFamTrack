import { getSteamFamDb } from "./supabase";
import { FamilyMemberInput, GameInfo, MemberLibrary, SteamRegion } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const APP_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h in-memory
const DB_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7d persistent DB cache
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

async function fetchAppDetailsFromSteam(
  appid: number,
  region: SteamRegion
): Promise<Partial<GameInfo> | null> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${region}&filters=price_overview,categories,is_free`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const entry = json?.[String(appid)];
    if (!entry?.success || !entry?.data) return null;

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
    const familySharingExcluded =
      !isFree && categories.length > 0 && !hasFamilySharing;

    return {
      rawPrice,
      isFree,
      familySharingExcluded,
    };
  } catch {
    return null;
  }
}

async function loadCachedPrices(
  appIds: number[],
  region: SteamRegion
): Promise<Map<number, Partial<GameInfo>>> {
  const result = new Map<number, Partial<GameInfo>>();
  const missingFromMem: number[] = [];
  const now = Date.now();

  for (const appid of appIds) {
    const mem = appDetailsCache.get(`${appid}:${region}`);
    if (mem && mem.expiresAt > now) {
      result.set(appid, mem.value);
    } else {
      missingFromMem.push(appid);
    }
  }

  if (missingFromMem.length === 0) return result;

  const db = getSteamFamDb();
  if (!db) return result;

  try {
    const cutoffIso = new Date(now - DB_CACHE_TTL_MS).toISOString();
    const { data } = await db
      .from("app_price_cache")
      .select("appid, raw_price, is_free, family_sharing_excluded")
      .eq("region", region)
      .in("appid", missingFromMem)
      .gte("updated_at", cutoffIso);

    if (Array.isArray(data)) {
      for (const row of data) {
        const info: Partial<GameInfo> = {
          rawPrice: Number(row.raw_price) || 0,
          isFree: Boolean(row.is_free),
          familySharingExcluded: Boolean(row.family_sharing_excluded),
        };
        result.set(row.appid, info);
        appDetailsCache.set(`${row.appid}:${region}`, {
          value: info,
          expiresAt: now + APP_CACHE_TTL_MS,
        });
      }
    }
  } catch {
    // Non-fatal: fall back to live Steam Store fetch
  }

  return result;
}

async function persistPriceCache(
  entries: { appid: number; name?: string; info: Partial<GameInfo> }[],
  region: SteamRegion
) {
  if (entries.length === 0) return;
  const db = getSteamFamDb();
  if (!db) return;

  try {
    const rows = entries.map((e) => ({
      appid: e.appid,
      region,
      name: e.name ?? null,
      raw_price: e.info.rawPrice ?? 0,
      is_free: Boolean(e.info.isFree),
      family_sharing_excluded: Boolean(e.info.familySharingExcluded),
      updated_at: new Date().toISOString(),
    }));
    await db
      .from("app_price_cache")
      .upsert(rows, { onConflict: "appid,region" });
  } catch {
    // Non-fatal cache write failure
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

  const uniqueAppNames = new Map<number, string>();
  for (const r of resolved) {
    for (const g of r.owned) {
      if (!uniqueAppNames.has(g.appid)) {
        uniqueAppNames.set(g.appid, g.name ?? `App ${g.appid}`);
      }
    }
  }

  const allAppIds = Array.from(uniqueAppNames.keys());
  const detailsMap = await loadCachedPrices(allAppIds, region);

  const uncachedIds = allAppIds
    .filter((id) => !detailsMap.has(id))
    .slice(0, MAX_STORE_LOOKUPS_PER_RUN);

  const newlyFetched: { appid: number; name?: string; info: Partial<GameInfo> }[] =
    [];
  const BATCH_SIZE = 8;
  const now = Date.now();

  for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
    const batch = uncachedIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (appid) => [
        appid,
        await fetchAppDetailsFromSteam(appid, region),
      ] as const)
    );
    for (const [appid, info] of results) {
      if (!info) continue;
      detailsMap.set(appid, info);
      appDetailsCache.set(`${appid}:${region}`, {
        value: info,
        expiresAt: now + APP_CACHE_TTL_MS,
      });
      newlyFetched.push({
        appid,
        name: uniqueAppNames.get(appid),
        info,
      });
    }
  }

  // Persist freshly fetched prices to Supabase `steamfam.app_price_cache`
  await persistPriceCache(newlyFetched, region);

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
