import type {
  FamilyMemberInput,
  GameInfo,
  MemberLibrary,
  SteamRegion,
} from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface MemberLookupWarning {
  memberId: string;
  memberName: string;
  steamInput: string;
  reason: string;
}

export interface SteamProfilePreview {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  gamesCount: number;
  isLibraryPublic: boolean;
  hint?: string;
}

const PRIVATE_LIBRARY_HINT =
  'Steam "Game details" is Private. Set Profile → Edit Profile → Privacy Settings → Game details → Public.';

export interface StoreBrowseItem {
  appid?: number;
  id?: number;
  success?: number;
  is_free?: boolean;
  best_purchase_option?: {
    original_price_in_cents?: string | number | null;
    final_price_in_cents?: string | number | null;
  } | null;
  categories?: {
    feature_categoryids?: number[];
    supported_player_categoryids?: number[];
    controller_categoryids?: number[];
  } | null;
}

const APP_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h in-memory
const DB_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7d persistent DB cache
const appDetailsCache = new Map<string, CacheEntry<Partial<GameInfo>>>();

const FAMILY_SHARING_CATEGORY_ID = 62;
const MAX_STORE_LOOKUPS_PER_RUN = 800;
const STORE_BROWSE_BATCH_SIZE = 80;
const STORE_BROWSE_CONCURRENCY = 3;
const FALLBACK_APPDETAILS_CAP = 25;
const FALLBACK_APPDETAILS_CONCURRENCY = 5;
const DB_CACHE_QUERY_CHUNK_SIZE = 200;

const REGION_TO_COUNTRY_CODE: Record<SteamRegion, string> = {
  ma: "MA",
  us: "US",
  eu: "DE",
  gb: "GB",
  br: "BR",
  jp: "JP",
};

async function loadSteamFamDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { getSteamFamDb } = await import("./supabase");
  return getSteamFamDb();
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "Unknown Steam lookup error";
}

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

export function parseStoreBrowseItem(
  item: StoreBrowseItem
): Pick<GameInfo, "rawPrice" | "isFree" | "familySharingExcluded"> {
  const isFree = Boolean(item.is_free);

  const originalCents = item.best_purchase_option?.original_price_in_cents;
  const cents =
    originalCents !== undefined &&
    originalCents !== null &&
    originalCents !== ""
      ? originalCents
      : item.best_purchase_option?.final_price_in_cents;
  const rawPrice = isFree ? 0 : Math.round(Number(cents) || 0) / 100;

  const allCategoryIds: number[] = [
    ...(Array.isArray(item.categories?.feature_categoryids)
      ? item.categories.feature_categoryids
      : []),
    ...(Array.isArray(item.categories?.supported_player_categoryids)
      ? item.categories.supported_player_categoryids
      : []),
    ...(Array.isArray(item.categories?.controller_categoryids)
      ? item.categories.controller_categoryids
      : []),
  ];

  const hasFamilySharing = allCategoryIds.includes(FAMILY_SHARING_CATEGORY_ID);
  const familySharingExcluded =
    !isFree && allCategoryIds.length > 0 && !hasFamilySharing;

  return {
    rawPrice,
    isFree,
    familySharingExcluded,
  };
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
  playtime_forever?: number;
}

export async function fetchSteamLevel(
  steamId64: string,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${encodeURIComponent(
      apiKey
    )}&steamid=${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const level = data?.response?.player_level;
    return typeof level === "number" && Number.isFinite(level) ? level : null;
  } catch {
    return null;
  }
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

export async function resolveSteamProfilePreview(
  input: string,
  apiKey: string
): Promise<SteamProfilePreview> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Steam profile URL, vanity name, or SteamID64 is required");
  }

  const steamId64 = await resolveSteamId64(trimmed, apiKey);

  const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(
    apiKey
  )}&steamid=${encodeURIComponent(
    steamId64
  )}&include_appinfo=0&include_played_free_games=0`;

  const [summary, ownedRes] = await Promise.all([
    fetchPlayerSummary(steamId64, apiKey),
    fetch(ownedGamesUrl),
  ]);

  if (!ownedRes.ok) {
    throw new Error(`Steam GetOwnedGames failed (${ownedRes.status})`);
  }

  const ownedData = await ownedRes.json();
  const games = ownedData?.response?.games;

  if (Array.isArray(games)) {
    return {
      steamId64,
      personaName: summary.personaName,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      gamesCount: games.length,
      isLibraryPublic: true,
    };
  }

  if (ownedData?.response?.game_count === 0) {
    return {
      steamId64,
      personaName: summary.personaName,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      gamesCount: 0,
      isLibraryPublic: true,
    };
  }

  return {
    steamId64,
    personaName: summary.personaName,
    avatarUrl: summary.avatarUrl,
    profileUrl: summary.profileUrl,
    gamesCount: 0,
    isLibraryPublic: false,
    hint: PRIVATE_LIBRARY_HINT,
  };
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

async function fetchStoreBrowseBatch(
  batch: number[],
  region: SteamRegion
): Promise<Map<number, Partial<GameInfo>> | null> {
  try {
    const countryCode = REGION_TO_COUNTRY_CODE[region];
    const payload = {
      ids: batch.map((appid) => ({ appid })),
      context: {
        language: "english",
        country_code: countryCode,
        steam_realm: 1,
      },
      data_request: {
        include_basic_info: true,
        include_tag_count: 0,
      },
    };

    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(
      JSON.stringify(payload)
    )}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const items = json?.response?.store_items;
    if (!Array.isArray(items)) return null;

    const batchResults = new Map<number, Partial<GameInfo>>();
    for (const rawItem of items as StoreBrowseItem[]) {
      const appid =
        typeof rawItem?.appid === "number"
          ? rawItem.appid
          : typeof rawItem?.id === "number"
            ? rawItem.id
            : null;
      if (appid === null) continue;
      if (typeof rawItem.success === "number" && rawItem.success !== 1) {
        continue;
      }
      batchResults.set(appid, parseStoreBrowseItem(rawItem));
    }

    return batchResults;
  } catch {
    return null;
  }
}

async function fetchFallbackAppDetails(
  appIds: number[],
  region: SteamRegion
): Promise<Map<number, Partial<GameInfo>>> {
  const results = new Map<number, Partial<GameInfo>>();
  const capped = appIds.slice(0, FALLBACK_APPDETAILS_CAP);

  for (let i = 0; i < capped.length; i += FALLBACK_APPDETAILS_CONCURRENCY) {
    const chunk = capped.slice(i, i + FALLBACK_APPDETAILS_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(
        async (appid) =>
          [appid, await fetchAppDetailsFromSteam(appid, region)] as const
      )
    );
    for (const [appid, info] of chunkResults) {
      if (info) {
        results.set(appid, info);
      }
    }
  }

  return results;
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

  const db = await loadSteamFamDb();
  if (!db) return result;

  try {
    const cutoffIso = new Date(now - DB_CACHE_TTL_MS).toISOString();
    for (let i = 0; i < missingFromMem.length; i += DB_CACHE_QUERY_CHUNK_SIZE) {
      const chunk = missingFromMem.slice(i, i + DB_CACHE_QUERY_CHUNK_SIZE);
      const { data } = await db
        .from("app_price_cache")
        .select("appid, raw_price, is_free, family_sharing_excluded")
        .eq("region", region)
        .in("appid", chunk)
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
  const db = await loadSteamFamDb();
  if (!db) return;

  try {
    const updatedAt = new Date().toISOString();
    for (let i = 0; i < entries.length; i += DB_CACHE_QUERY_CHUNK_SIZE) {
      const chunk = entries.slice(i, i + DB_CACHE_QUERY_CHUNK_SIZE);
      const rows = chunk.map((e) => ({
        appid: e.appid,
        region,
        name: e.name ?? null,
        raw_price: e.info.rawPrice ?? 0,
        is_free: Boolean(e.info.isFree),
        family_sharing_excluded: Boolean(e.info.familySharingExcluded),
        updated_at: updatedAt,
      }));
      await db
        .from("app_price_cache")
        .upsert(rows, { onConflict: "appid,region" });
    }
  } catch {
    // Non-fatal cache write failure
  }
}

export async function fetchMemberLibrariesLive(
  members: FamilyMemberInput[],
  region: SteamRegion,
  apiKey: string
): Promise<{ libraries: MemberLibrary[]; warnings: MemberLookupWarning[] }> {
  const settledMembers = await Promise.allSettled(
    members.map(async (member) => {
      const steamId64 = await resolveSteamId64(member.steamUrlOrId, apiKey);
      const [summaryResult, ownedResult] = await Promise.allSettled([
        fetchPlayerSummary(steamId64, apiKey),
        fetchOwnedGames(steamId64, apiKey),
      ]);

      if (ownedResult.status === "rejected") {
        throw ownedResult.reason;
      }

      const summary =
        summaryResult.status === "fulfilled"
          ? summaryResult.value
          : {
              personaName: member.name || steamId64,
              avatarUrl: "",
              profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
            };

      return { member, steamId64, summary, owned: ownedResult.value };
    })
  );

  const resolved: {
    member: FamilyMemberInput;
    steamId64: string;
    summary: { personaName: string; avatarUrl: string; profileUrl: string };
    owned: RawOwnedGame[];
  }[] = [];
  const warnings: MemberLookupWarning[] = [];

  settledMembers.forEach((result, index) => {
    const member = members[index];
    if (result.status === "fulfilled") {
      resolved.push(result.value);
    } else {
      warnings.push({
        memberId: member.id,
        memberName: member.name,
        steamInput: member.steamUrlOrId,
        reason: getErrorMessage(result.reason),
      });
    }
  });

  if (resolved.length === 0) {
    return { libraries: [], warnings };
  }

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

  const newlyFetched: {
    appid: number;
    name?: string;
    info: Partial<GameInfo>;
  }[] = [];
  const now = Date.now();

  const batches: number[][] = [];
  for (let i = 0; i < uncachedIds.length; i += STORE_BROWSE_BATCH_SIZE) {
    batches.push(uncachedIds.slice(i, i + STORE_BROWSE_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += STORE_BROWSE_CONCURRENCY) {
    const group = batches.slice(i, i + STORE_BROWSE_CONCURRENCY);
    const groupResults = await Promise.all(
      group.map(async (batch) => {
        const browseMap = await fetchStoreBrowseBatch(batch, region);
        if (browseMap !== null) {
          return browseMap;
        }
        return fetchFallbackAppDetails(batch, region);
      })
    );

    for (const batchMap of groupResults) {
      for (const [appid, info] of batchMap.entries()) {
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
  }

  // Persist freshly fetched prices to Supabase `steamfam.app_price_cache`
  await persistPriceCache(newlyFetched, region);

  const libraries: MemberLibrary[] = resolved.map(
    ({ member, steamId64, summary, owned }) => {
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
          playtimeMinutes: Math.max(0, Math.round(Number(g.playtime_forever) || 0)),
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
    }
  );

  return { libraries, warnings };
}

export interface SteamProfileFlexGame {
  appid: number;
  name: string;
  rawPrice: number;
  isFree: boolean;
  familySharingExcluded: boolean;
  playtimeHours: number;
  headerImage: string;
}

export interface SteamProfileFlexData {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  steamLevel: number | null;
  region: SteamRegion;
  totalGames: number;
  shareableGames: number;
  excludedGames: number;
  totalRawValue: number;
  shareableRawValue: number;
  avgGameValue: number;
  totalPlaytimeHours: number;
  topValueGames: SteamProfileFlexGame[];
  topPlayedGames: SteamProfileFlexGame[];
}

export async function fetchSteamProfileFlex(
  input: string,
  region: SteamRegion,
  apiKey: string
): Promise<SteamProfileFlexData> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Steam profile URL, vanity name, or SteamID64 is required");
  }

  const steamId64 = await resolveSteamId64(trimmed, apiKey);
  const [steamLevel, { libraries, warnings }] = await Promise.all([
    fetchSteamLevel(steamId64, apiKey),
    fetchMemberLibrariesLive(
      [{ id: "profile", name: trimmed, steamUrlOrId: steamId64 }],
      region,
      apiKey
    ),
  ]);

  const lib = libraries[0];
  if (!lib) {
    throw new Error(
      warnings[0]?.reason ||
        `Could not load Steam library for ${steamId64}. Ensure Game details are Public.`
    );
  }

  let totalRawValue = 0;
  let shareableRawValue = 0;
  let shareableGames = 0;
  let totalMinutes = 0;

  const mapped: SteamProfileFlexGame[] = lib.games.map((g) => {
    const mins = g.playtimeMinutes ?? 0;
    totalMinutes += mins;
    totalRawValue += g.rawPrice;
    if (!g.familySharingExcluded) {
      shareableGames += 1;
      shareableRawValue += g.rawPrice;
    }
    return {
      appid: g.appid,
      name: g.name,
      rawPrice: Math.round(g.rawPrice * 100) / 100,
      isFree: g.isFree,
      familySharingExcluded: g.familySharingExcluded,
      playtimeHours: Math.round((mins / 60) * 10) / 10,
      headerImage: g.headerImage,
    };
  });

  const topValueGames = [...mapped]
    .filter((g) => !g.isFree && g.rawPrice > 0)
    .sort((a, b) => b.rawPrice - a.rawPrice || b.playtimeHours - a.playtimeHours)
    .slice(0, 5);

  const topPlayedGames = [...mapped]
    .filter((g) => g.playtimeHours > 0)
    .sort((a, b) => b.playtimeHours - a.playtimeHours || b.rawPrice - a.rawPrice)
    .slice(0, 5);

  const totalGames = lib.games.length;
  const roundedTotal = Math.round(totalRawValue * 100) / 100;
  const roundedShareable = Math.round(shareableRawValue * 100) / 100;

  return {
    steamId64: lib.steamId64,
    personaName: lib.personaName,
    avatarUrl: lib.avatarUrl,
    profileUrl: lib.profileUrl,
    steamLevel,
    region,
    totalGames,
    shareableGames,
    excludedGames: lib.excludedCount,
    totalRawValue: roundedTotal,
    shareableRawValue: roundedShareable,
    avgGameValue:
      totalGames > 0 ? Math.round((roundedTotal / totalGames) * 100) / 100 : 0,
    totalPlaytimeHours: Math.round((totalMinutes / 60) * 10) / 10,
    topValueGames,
    topPlayedGames,
  };
}
