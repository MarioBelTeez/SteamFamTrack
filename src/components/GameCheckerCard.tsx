"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  EnrichedStoreGame,
  FamilyWishlistGame,
  SteamGameCheckResult,
} from "@/lib/steam-check";
import {
  FairnessSummary,
  MemberLibrary,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  Check,
  CheckCircle2,
  Copy,
  Dices,
  ExternalLink,
  Flame,
  Gift,
  Loader2,
  Lock,
  Megaphone,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";

type RouletteMode = "fairness" | "equal";
type BrowserTab = "discounts" | "wishlists" | "starred";

interface ClaimedGameEntry {
  byName: string;
  at: string;
}

type ClaimedGamesMap = Record<string, ClaimedGameEntry>;

const STARRED_STORAGE_KEY = "sft_starred_games_v1";
const CLAIMED_STORAGE_KEY = "sft_claimed_games_v1";

interface GameCheckerCardProps {
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
  fairness?: FairnessSummary;
  currentUserName?: string;
}

function toEnrichedStoreGame(r: SteamGameCheckResult): EnrichedStoreGame {
  return {
    appid: r.appid,
    name: r.name,
    headerImage: r.headerImage,
    storeUrl: r.storeUrl,
    isFree: r.isFree,
    familySharingSupported: r.familySharingSupported,
    discountPercent: r.priceOverview?.discountPercent ?? 0,
    initialFormatted: r.priceOverview?.initialFormatted ?? "",
    finalFormatted: r.isFree ? "Free" : r.priceOverview?.finalFormatted ?? "",
    finalPriceCents: r.priceOverview
      ? Math.round(r.priceOverview.final * 100)
      : 0,
  };
}

function buildAnnouncementText(result: SteamGameCheckResult): string {
  const priceLabel = result.isFree
    ? "Free"
    : result.priceOverview?.finalFormatted || "Price N/A";
  const discount = result.priceOverview?.discountPercent ?? 0;
  const pricePart =
    discount > 0 ? `${priceLabel}, -${discount}%` : priceLabel;
  return `🛒 I'll buy ${result.name} (${pricePart}) for the Steam Family!`;
}

function loadStarredFromStorage(): EnrichedStoreGame[] {
  try {
    const raw = window.localStorage.getItem(STARRED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is EnrichedStoreGame =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.appid === "number" &&
        typeof item.name === "string"
    );
  } catch {
    return [];
  }
}

function saveStarredToStorage(games: EnrichedStoreGame[]): void {
  try {
    window.localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(games));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function loadClaimedFromStorage(): ClaimedGamesMap {
  try {
    const raw = window.localStorage.getItem(CLAIMED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const clean: ClaimedGamesMap = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (
        val &&
        typeof val === "object" &&
        typeof (val as ClaimedGameEntry).byName === "string" &&
        typeof (val as ClaimedGameEntry).at === "string"
      ) {
        clean[key] = {
          byName: (val as ClaimedGameEntry).byName,
          at: (val as ClaimedGameEntry).at,
        };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveClaimedToStorage(claimed: ClaimedGamesMap): void {
  try {
    window.localStorage.setItem(CLAIMED_STORAGE_KEY, JSON.stringify(claimed));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

interface BrowseGameCardProps {
  game: EnrichedStoreGame;
  isStarred: boolean;
  claim?: ClaimedGameEntry;
  owners: string[];
  isSelected: boolean;
  wishedBy?: Array<{ memberId: string; name: string; steamId64: string }>;
  wishCount?: number;
  onInspect: (appid: number) => void;
  onToggleStar: (game: EnrichedStoreGame) => void;
}

function BrowseGameCard({
  game,
  isStarred,
  claim,
  owners,
  isSelected,
  wishedBy,
  wishCount,
  onInspect,
  onToggleStar,
}: BrowseGameCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onInspect(game.appid)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect(game.appid);
        }
      }}
      className={`group text-left bg-bt-surface border transition-all cursor-pointer flex flex-col overflow-hidden focus:outline-none focus:border-bt-red ${
        isSelected
          ? "border-bt-red shadow-[0_0_0_1px_#E8002D]"
          : "border-bt-border hover:border-bt-red/70"
      }`}
    >
      <div className="relative w-full aspect-[460/215] bg-bt-bg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.headerImage}
          alt={game.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35 pointer-events-none" />

        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
          {game.discountPercent > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500 text-black font-mono text-[11px] font-extrabold tracking-tight shadow">
              -{game.discountPercent}%
            </span>
          )}
          {claim && (
            <span className="px-2 py-0.5 bg-bt-red text-white font-mono text-[10px] font-bold uppercase tracking-wider shadow">
              CLAIMED
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(game);
          }}
          aria-label={isStarred ? `Unstar ${game.name}` : `Star ${game.name}`}
          title={isStarred ? "Remove from Starred" : "Star this game"}
          className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center border transition-colors cursor-pointer ${
            isStarred
              ? "bg-black/80 border-amber-400/80 text-amber-400"
              : "bg-black/65 border-white/20 text-white/75 hover:text-amber-300 hover:border-amber-400/60"
          }`}
        >
          <Star
            className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`}
          />
        </button>

        {typeof wishCount === "number" && wishCount > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-0.5 bg-bt-red/95 border border-white/20 text-white font-mono text-[10px] font-bold uppercase tracking-wider shadow">
              {wishCount} {wishCount === 1 ? "WANTS" : "WANT"} THIS
            </span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
        <div className="space-y-2.5">
          <h4 className="font-display text-lg sm:text-xl leading-tight text-white group-hover:text-bt-red transition-colors line-clamp-2">
            {game.name}
          </h4>

          <div className="flex flex-wrap items-center gap-2">
            {game.isFree ? (
              <span className="px-2 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase tracking-wider">
                Free to Play
              </span>
            ) : game.familySharingSupported ? (
              <span className="px-2 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Family Share
              </span>
            ) : (
              <span className="px-2 py-1 bg-bt-red/15 border border-bt-red/40 text-red-200 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-bt-red" /> No Sharing
              </span>
            )}

            {owners.length > 0 && (
              <span className="px-2 py-1 bg-sky-500/15 border border-sky-500/40 text-sky-200 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {owners.length === 1
                  ? `Owned: ${owners[0]}`
                  : `Owned (${owners.length})`}
              </span>
            )}
          </div>

          {wishedBy && wishedBy.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {wishedBy.map((w) => (
                <span
                  key={w.memberId}
                  className="px-1.5 py-0.5 bg-bt-bg border border-bt-border text-[10px] font-mono text-bt-muted"
                >
                  {w.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2.5 border-t border-bt-border/70 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            {game.isFree ? (
              <span className="font-display text-lg text-emerald-400">
                FREE
              </span>
            ) : game.finalFormatted ? (
              <>
                <span className="font-display text-lg text-white">
                  {game.finalFormatted}
                </span>
                {game.discountPercent > 0 && game.initialFormatted && (
                  <span className="font-mono text-[11px] text-bt-dim line-through truncate">
                    {game.initialFormatted}
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-xs text-bt-muted">
                Price unavailable
              </span>
            )}
          </div>

          <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim group-hover:text-white transition-colors shrink-0">
            Inspect →
          </span>
        </div>
      </div>
    </div>
  );
}

export function GameCheckerCard({
  activeLibraries,
  waitlistLibraries,
  region,
  fairness,
  currentUserName,
}: GameCheckerCardProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SteamGameCheckResult | null>(null);
  const [rouletteMode, setRouletteMode] = useState<RouletteMode>("fairness");
  const [spinning, setSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const [starredGames, setStarredGames] = useState<EnrichedStoreGame[]>([]);
  const [claimedGames, setClaimedGames] = useState<ClaimedGamesMap>({});
  const [justClaimedAppId, setJustClaimedAppId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<BrowserTab>("discounts");
  const [discounts, setDiscounts] = useState<EnrichedStoreGame[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [discountsError, setDiscountsError] = useState<string | null>(null);

  const [wishlists, setWishlists] = useState<FamilyWishlistGame[]>([]);
  const [wishlistPrivateMembers, setWishlistPrivateMembers] = useState<
    string[]
  >([]);
  const [wishlistsLoading, setWishlistsLoading] = useState(false);
  const [wishlistsError, setWishlistsError] = useState<string | null>(null);

  const spinTimersRef = useRef<number[]>([]);
  const claimFeedbackTimerRef = useRef<number | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const rouletteRef = useRef<HTMLDivElement | null>(null);

  const clearSpinTimers = useCallback(() => {
    for (const timer of spinTimersRef.current) {
      window.clearTimeout(timer);
    }
    spinTimersRef.current = [];
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setStarredGames(loadStarredFromStorage());
      setClaimedGames(loadClaimedFromStorage());
    });

    return () => {
      clearSpinTimers();
      if (claimFeedbackTimerRef.current !== null) {
        window.clearTimeout(claimFeedbackTimerRef.current);
      }
    };
  }, [clearSpinTimers]);

  const fetchDiscounts = useCallback(async (targetRegion: SteamRegion, signal?: AbortSignal) => {
    setDiscountsLoading(true);
    setDiscountsError(null);
    try {
      const res = await fetch(
        `/api/steam/discounts?region=${encodeURIComponent(targetRegion)}`,
        { signal }
      );
      const data = (await res.json()) as {
        items?: EnrichedStoreGame[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Steam discounts");
      }
      setDiscounts(data.items ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setDiscountsError(
        err instanceof Error ? err.message : "Failed to load Steam discounts"
      );
    } finally {
      if (!signal?.aborted) {
        setDiscountsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void fetchDiscounts(region, controller.signal);
      }
    });
    return () => controller.abort();
  }, [region, fetchDiscounts]);

  const wishlistMembersPayload = useMemo(
    () =>
      activeLibraries.map((l) => ({
        memberId: l.member.id,
        name: l.personaName || l.member.name,
        steamId64: l.steamId64,
      })),
    [activeLibraries]
  );

  const wishlistMembersKey = useMemo(
    () =>
      wishlistMembersPayload
        .map((m) => `${m.memberId}:${m.steamId64}:${m.name}`)
        .join("|"),
    [wishlistMembersPayload]
  );

  const fetchWishlists = useCallback(
    async (
      targetRegion: SteamRegion,
      members: Array<{ memberId: string; name: string; steamId64: string }>,
      signal?: AbortSignal
    ) => {
      if (members.length === 0) {
        setWishlists([]);
        setWishlistPrivateMembers([]);
        setWishlistsError(null);
        setWishlistsLoading(false);
        return;
      }

      setWishlistsLoading(true);
      setWishlistsError(null);
      try {
        const res = await fetch("/api/steam/wishlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region: targetRegion, members }),
          signal,
        });
        const data = (await res.json()) as {
          items?: FamilyWishlistGame[];
          privateMembers?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Failed to load family wishlists");
        }
        setWishlists(data.items ?? []);
        setWishlistPrivateMembers(data.privateMembers ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setWishlistsError(
          err instanceof Error ? err.message : "Failed to load family wishlists"
        );
      } finally {
        if (!signal?.aborted) {
          setWishlistsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void fetchWishlists(region, wishlistMembersPayload, controller.signal);
      }
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, wishlistMembersKey, fetchWishlists]);

  async function runCheck(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    clearSpinTimers();
    setSpinning(false);
    setHighlightedIndex(null);
    setWinnerId(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/steam/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, region }),
      });
      const data = (await res.json()) as SteamGameCheckResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to check game");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check game");
    } finally {
      setLoading(false);
    }
  }

  function inspectFromBrowser(appid: number) {
    spotlightRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    void runCheck(String(appid));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runCheck(query);
  }

  const toggleStar = useCallback((game: EnrichedStoreGame) => {
    setStarredGames((prev) => {
      const exists = prev.some((item) => item.appid === game.appid);
      const next = exists
        ? prev.filter((item) => item.appid !== game.appid)
        : [game, ...prev];
      saveStarredToStorage(next);
      return next;
    });
  }, []);

  const starredAppIds = useMemo(
    () => new Set(starredGames.map((g) => g.appid)),
    [starredGames]
  );

  const ownedByAppId = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const lib of activeLibraries) {
      const ownerName = lib.personaName || lib.member.name;
      for (const game of lib.games) {
        const list = map.get(game.appid);
        if (list) {
          if (!list.includes(ownerName)) list.push(ownerName);
        } else {
          map.set(game.appid, [ownerName]);
        }
      }
    }
    return map;
  }, [activeLibraries]);

  const handleAnnounceClaim = useCallback(
    async (gameResult: SteamGameCheckResult) => {
      const byName =
        currentUserName || activeLibraries[0]?.member.name || "Me";
      const nextEntry: ClaimedGameEntry = {
        byName,
        at: new Date().toISOString(),
      };
      setClaimedGames((prev) => {
        const next: ClaimedGamesMap = {
          ...prev,
          [String(gameResult.appid)]: nextEntry,
        };
        saveClaimedToStorage(next);
        return next;
      });

      const announcement = buildAnnouncementText(gameResult);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(announcement);
        }
      } catch {
        // Clipboard access may be blocked in non-HTTPS contexts
      }

      if (claimFeedbackTimerRef.current !== null) {
        window.clearTimeout(claimFeedbackTimerRef.current);
      }
      setJustClaimedAppId(gameResult.appid);
      claimFeedbackTimerRef.current = window.setTimeout(() => {
        setJustClaimedAppId(null);
      }, 3200);
    },
    [activeLibraries, currentUserName]
  );

  const handleUnclaim = useCallback((appid: number) => {
    setClaimedGames((prev) => {
      const next = { ...prev };
      delete next[String(appid)];
      saveClaimedToStorage(next);
      return next;
    });
    setJustClaimedAppId((prev) => (prev === appid ? null : prev));
  }, []);

  const ownership = useMemo(() => {
    if (!result) return { activeOwners: [], waitlistOwners: [] };
    const activeOwners = activeLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === result.appid)
    );
    const waitlistOwners = waitlistLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === result.appid)
    );
    return { activeOwners, waitlistOwners };
  }, [result, activeLibraries, waitlistLibraries]);

  const rouletteEntries = useMemo(() => {
    if (activeLibraries.length === 0) return [];
    const weighted = activeLibraries.map((lib) => {
      const fairnessMember = fairness?.members.find(
        (m) => m.memberId === lib.member.id
      );
      const delta = fairnessMember?.deltaFromAverageValue ?? 0;
      const weight =
        rouletteMode === "equal"
          ? 1
          : Math.max(10, delta < 0 ? Math.abs(delta) + 50 : 25);
      const displayName = lib.personaName || lib.member.name;
      return {
        memberId: lib.member.id,
        displayName,
        avatarUrl: lib.avatarUrl,
        weight,
        isUpNext: fairnessMember?.isUpNext ?? false,
      };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    return weighted.map((entry) => {
      const odds = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0;
      const oddsLabel = `${odds.toFixed(1).replace(/\.0$/, "")}%`;
      return {
        ...entry,
        odds,
        oddsLabel,
      };
    });
  }, [activeLibraries, fairness, rouletteMode]);

  const selectedWinner = useMemo(
    () => rouletteEntries.find((entry) => entry.memberId === winnerId) ?? null,
    [rouletteEntries, winnerId]
  );

  function handleModeChange(nextMode: RouletteMode) {
    if (nextMode === rouletteMode) return;
    clearSpinTimers();
    setSpinning(false);
    setHighlightedIndex(null);
    setWinnerId(null);
    setRouletteMode(nextMode);
  }

  function spinRoulette() {
    if (rouletteEntries.length === 0 || spinning) return;

    clearSpinTimers();
    setWinnerId(null);
    setSpinning(true);

    const totalWeight = rouletteEntries.reduce(
      (sum, entry) => sum + entry.weight,
      0
    );
    let roll = Math.random() * totalWeight;
    let winnerIdx = rouletteEntries.length - 1;
    for (let i = 0; i < rouletteEntries.length; i++) {
      roll -= rouletteEntries[i].weight;
      if (roll <= 0) {
        winnerIdx = i;
        break;
      }
    }

    const n = rouletteEntries.length;
    const startIdx =
      highlightedIndex !== null ? (highlightedIndex + 1) % n : 0;
    const baseSteps = n === 1 ? 6 : Math.max(14, n * 3);
    const offset = (winnerIdx - startIdx + n) % n;
    const remainder = (baseSteps - 1) % n;
    const steps = baseSteps + ((offset - remainder + n) % n);

    const rawDelays = Array.from({ length: steps }, (_, i) => {
      const t = steps > 1 ? i / (steps - 1) : 1;
      return 38 + 185 * t * t;
    });
    const rawTotal = rawDelays.reduce((sum, d) => sum + d, 0);
    const targetDurationMs = n === 1 ? 650 : 1400;
    const scale = rawTotal > 0 ? targetDurationMs / rawTotal : 1;

    setHighlightedIndex(startIdx);
    let elapsed = 0;
    for (let i = 1; i < steps; i++) {
      const idx = (startIdx + i) % n;
      const isLast = i === steps - 1;
      elapsed += rawDelays[i] * scale;
      const timer = window.setTimeout(() => {
        setHighlightedIndex(idx);
        if (isLast) {
          setSpinning(false);
          setWinnerId(rouletteEntries[winnerIdx].memberId);
        }
      }, elapsed);
      spinTimersRef.current.push(timer);
    }
  }

  function handleSpinFromHero() {
    rouletteRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    spinRoulette();
  }

  const regionInfo = STEAM_REGIONS[region];
  const resultClaim = result ? claimedGames[String(result.appid)] : undefined;
  const resultStarred = result ? starredAppIds.has(result.appid) : false;

  return (
    <div className="space-y-7">
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-red">
                PRE-PURCHASE &amp; DISCOUNT CHECKER // {regionInfo.label}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-white mt-1">
                SHOULD YOU BUY THIS GAME?
              </h2>
            </div>
            <span className="p5-tag bg-bt-elevated border border-bt-border px-3 py-1 text-bt-muted">
              <span className="p5-unskew inline-block font-mono text-[10px] uppercase tracking-widest">
                LIVE STEAM STORE + FAMILY OVERLAP
              </span>
            </span>
          </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-bt-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Game title, AppID (e.g. 1245620), or Steam Store URL..."
              className="w-full bg-bt-surface border border-bt-border pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-bt-dim focus:outline-none focus:border-bt-red"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="p5-btn bg-bt-red hover:bg-bt-red/90 disabled:opacity-50 text-white px-5 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Checking...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Check Game
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="border border-bt-red/50 bg-bt-red/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-bt-red shrink-0" />
            <span>{error}</span>
          </div>
        )}
        </div>
      </div>

      {/* Spotlight Anchor & Hero Card */}
      <div ref={spotlightRef} className="scroll-mt-4">
        {result && (
          <div className="p5-frame bg-bt-card border border-bt-border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr]">
              {/* Left Hero Image & Pricing Column */}
              <div className="bg-bt-surface border-b lg:border-b-0 lg:border-r border-bt-border flex flex-col justify-between">
                <div className="relative w-full aspect-[460/215] bg-bt-bg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.headerImage}
                    alt={result.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none" />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                    {result.priceOverview &&
                      result.priceOverview.discountPercent > 0 && (
                        <span className="px-2.5 py-1 bg-emerald-500 text-black font-mono text-xs font-extrabold tracking-tight shadow-md inline-flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />-
                          {result.priceOverview.discountPercent}%
                        </span>
                      )}
                    {resultClaim && (
                      <span className="px-2.5 py-1 bg-bt-red text-white font-mono text-[11px] font-bold uppercase tracking-wider shadow-md">
                        CLAIMED BY {resultClaim.byName.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStar(toEnrichedStoreGame(result))}
                    aria-label={
                      resultStarred
                        ? `Unstar ${result.name}`
                        : `Star ${result.name}`
                    }
                    title={
                      resultStarred ? "Remove from Starred" : "Star this game"
                    }
                    className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer ${
                      resultStarred
                        ? "bg-black/85 border-amber-400 text-amber-400"
                        : "bg-black/70 border-white/25 text-white/80 hover:text-amber-300 hover:border-amber-400"
                    }`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        resultStarred ? "fill-amber-400 text-amber-400" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-bt-dim">
                      APPID {result.appid}
                    </span>
                    <a
                      href={result.storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-bt-red hover:underline"
                    >
                      Steam Store <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="border-t border-bt-border/70 pt-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-bt-dim mb-1">
                      CURRENT PRICE ({regionInfo.code.toUpperCase()})
                    </div>
                    {result.isFree ? (
                      <div className="font-display text-3xl text-emerald-400">
                        FREE TO PLAY
                      </div>
                    ) : result.priceOverview ? (
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        {result.priceOverview.discountPercent > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold inline-flex items-center gap-1">
                            <Tag className="w-3 h-3" />-
                            {result.priceOverview.discountPercent}%
                          </span>
                        )}
                        <span className="font-display text-3xl text-white">
                          {result.priceOverview.finalFormatted}
                        </span>
                        {result.priceOverview.discountPercent > 0 &&
                          result.priceOverview.initialFormatted && (
                            <span className="font-mono text-xs text-bt-dim line-through">
                              {result.priceOverview.initialFormatted}
                            </span>
                          )}
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-bt-muted">
                        Price unavailable in this region
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Details, Action Buttons & Family Ownership Column */}
              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-3xl sm:text-4xl text-white tracking-wide leading-none">
                      {result.name}
                    </h3>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {result.isFree ? (
                        <span className="p5-tag bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Free to Play
                        </span>
                      ) : result.familySharingSupported ? (
                        <span className="p5-tag bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Family
                          Sharing Supported
                        </span>
                      ) : (
                        <span className="p5-tag bg-bt-red/15 border border-bt-red/50 text-red-200 inline-flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-bt-red" />{" "}
                          Opted Out of Family Sharing
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-bt-muted mt-2">
                      {result.familySharingNote}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStar(toEnrichedStoreGame(result))}
                    className={`px-3 py-1.5 border font-mono text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                      resultStarred
                        ? "bg-amber-400/15 border-amber-400/70 text-amber-300 font-bold"
                        : "bg-bt-surface border-bt-border text-bt-muted hover:text-white hover:border-amber-400/60"
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        resultStarred ? "fill-amber-400 text-amber-400" : ""
                      }`}
                    />
                    {resultStarred ? "Starred" : "Star"}
                  </button>
                </div>

                {/* 2 Prominent Spotlight Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {resultClaim ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAnnounceClaim(result)}
                        className="p5-btn bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {justClaimedAppId === result.appid ? (
                          <>
                            <Check className="w-4 h-4" /> Claimed &amp; Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" /> Claimed by{" "}
                            {resultClaim.byName} (Copy)
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnclaim(result.appid)}
                        className="px-3.5 py-2.5 bg-bt-surface hover:border-bt-red border border-bt-border font-mono text-xs uppercase tracking-wider text-bt-muted hover:text-white transition-colors cursor-pointer"
                      >
                        Unclaim
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAnnounceClaim(result)}
                      className="p5-btn bg-bt-red hover:bg-bt-red-hover text-white px-5 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Megaphone className="w-4 h-4" /> Announce I&apos;ll Buy
                      This
                    </button>
                  )}

                  {activeLibraries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSpinFromHero}
                      disabled={spinning}
                      className="p5-btn bg-bt-surface hover:bg-bt-elevated border border-bt-border hover:border-bt-red disabled:opacity-60 text-white px-5 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      {spinning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-bt-red" />{" "}
                          Spinning...
                        </>
                      ) : (
                        <>
                          <Dices className="w-4 h-4 text-bt-red" /> Spin the
                          Wheel
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="border-t border-bt-border pt-4 space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-bt-red" /> FAMILY
                    OWNERSHIP CHECK
                  </div>

                  {ownership.activeOwners.length > 0 ? (
                    <div className="border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2">
                      <div className="text-sm font-semibold text-emerald-300">
                        {result.familySharingSupported
                          ? `Already in your family! (${ownership.activeOwners.length} member${ownership.activeOwners.length > 1 ? "s" : ""} own it)`
                          : `Owned by ${ownership.activeOwners.length} active member${ownership.activeOwners.length > 1 ? "s" : ""}, but Family Sharing is disabled`}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ownership.activeOwners.map((owner) => (
                          <span
                            key={owner.member.id}
                            className="px-2.5 py-1 bg-bt-surface border border-bt-border text-xs font-mono text-white"
                          >
                            {owner.personaName || owner.member.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-bt-border bg-bt-surface/70 p-3.5 text-sm text-bt-muted">
                      Nobody in your active 6-slot family owns{" "}
                      <span className="text-white font-medium">
                        {result.name}
                      </span>{" "}
                      yet.
                    </div>
                  )}

                  {ownership.waitlistOwners.length > 0 && (
                    <div className="text-xs font-mono text-bt-muted">
                      Waitlist owners:{" "}
                      <span className="text-white">
                        {ownership.waitlistOwners
                          .map((o) => o.personaName || o.member.name)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Buyer Roulette & Other Store Matches */}
            {(activeLibraries.length > 0 || result.alternatives.length > 1) && (
              <div className="p-5 sm:p-6 border-t border-bt-border space-y-5">
                {activeLibraries.length > 0 && (
                  <div ref={rouletteRef} className="space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim flex items-center gap-1.5">
                        <Dices className="w-3.5 h-3.5 text-bt-red" /> WHO BUYS
                        THIS? // BUYER ROULETTE
                      </div>

                      <div
                        role="group"
                        aria-label="Buyer roulette odds mode"
                        className="inline-flex items-center bg-bt-bg border border-bt-border p-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => handleModeChange("fairness")}
                          className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors cursor-pointer ${
                            rouletteMode === "fairness"
                              ? "bg-bt-red text-white font-bold"
                              : "text-bt-muted hover:text-white"
                          }`}
                        >
                          <Scale className="w-3 h-3" /> Fairness-Weighted
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange("equal")}
                          className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer ${
                            rouletteMode === "equal"
                              ? "bg-bt-red text-white font-bold"
                              : "text-bt-muted hover:text-white"
                          }`}
                        >
                          Equal Odds
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {rouletteEntries.map((entry, idx) => {
                        const isHighlighted =
                          spinning && highlightedIndex === idx;
                        const isWinner =
                          !spinning &&
                          selectedWinner?.memberId === entry.memberId;
                        return (
                          <div
                            key={entry.memberId}
                            className={`flex items-center justify-between gap-2 px-2.5 py-2 border transition-all duration-100 ${
                              isWinner
                                ? "border-bt-red bg-bt-red/20 shadow-[0_0_0_1px_#E8002D]"
                                : isHighlighted
                                  ? "border-bt-red bg-bt-red/25 text-white scale-[1.02] shadow-[0_0_14px_rgba(232,0,45,0.45)]"
                                  : "border-bt-border bg-bt-surface/80"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {entry.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={entry.avatarUrl}
                                  alt={entry.displayName}
                                  className={`w-7 h-7 object-cover shrink-0 border ${
                                    isHighlighted || isWinner
                                      ? "border-bt-red"
                                      : "border-bt-border"
                                  }`}
                                />
                              ) : (
                                <div className="w-7 h-7 shrink-0 bg-bt-elevated border border-bt-border flex items-center justify-center font-mono text-[10px] font-bold text-bt-muted">
                                  {entry.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span
                                className={`text-xs font-medium truncate ${
                                  isHighlighted || isWinner
                                    ? "text-white font-semibold"
                                    : "text-white/90"
                                }`}
                              >
                                {entry.displayName}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 border ${
                                isWinner || isHighlighted
                                  ? "border-bt-red/70 bg-bt-red/20 text-white font-bold"
                                  : "border-bt-border bg-bt-bg text-bt-muted"
                              }`}
                            >
                              {entry.oddsLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={spinRoulette}
                        disabled={spinning}
                        className="p5-btn bg-bt-red hover:bg-bt-red-hover disabled:opacity-60 text-white px-5 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {spinning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Spinning...
                          </>
                        ) : selectedWinner ? (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            Spin Again
                          </>
                        ) : (
                          <>
                            <Dices className="w-4 h-4" />
                            Spin Buyer Roulette
                          </>
                        )}
                      </button>

                      <span className="font-mono text-[11px] text-bt-muted">
                        {rouletteMode === "fairness"
                          ? "Members behind group average carry higher odds"
                          : "Every active member has equal odds"}
                      </span>
                    </div>

                    {selectedWinner && !spinning && (
                      <div className="p5-frame-sm bg-bt-red">
                        <div className="bg-bt-red px-4 py-3.5 text-white flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {selectedWinner.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedWinner.avatarUrl}
                                alt={selectedWinner.displayName}
                                className="w-10 h-10 object-cover border-2 border-white/80 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-black/30 border-2 border-white/80 flex items-center justify-center shrink-0">
                                <Trophy className="w-5 h-5 text-white" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/85 flex items-center gap-1.5">
                                <Trophy className="w-3 h-3 shrink-0" />
                                ROULETTE VERDICT // {selectedWinner.oddsLabel}{" "}
                                ODDS
                              </div>
                              <div className="font-display text-xl sm:text-2xl tracking-wide leading-tight mt-0.5 break-words">
                                {selectedWinner.displayName.toUpperCase()} PAYS
                                THE TAB FOR {result.name.toUpperCase()}!
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={spinRoulette}
                            className="px-3 py-1.5 bg-black/25 hover:bg-black/40 border border-white/40 font-mono text-[11px] font-bold uppercase tracking-wider text-white inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Spin Again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {result.alternatives.length > 1 && (
                  <div
                    className={`${
                      activeLibraries.length > 0
                        ? "border-t border-bt-border pt-4"
                        : ""
                    } space-y-2`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim">
                      OTHER STORE MATCHES
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.alternatives
                        .filter((alt) => alt.appid !== result.appid)
                        .map((alt) => (
                          <button
                            key={alt.appid}
                            type="button"
                            onClick={() => void runCheck(String(alt.appid))}
                            className="px-2.5 py-1 bg-bt-surface hover:border-bt-red border border-bt-border text-xs text-bt-muted hover:text-white transition-colors cursor-pointer"
                          >
                            {alt.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3-Tab Game Browser */}
      <div className="p5-frame bg-bt-card border border-bt-border p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bt-border pb-4">
          <div
            role="tablist"
            aria-label="Game browser tabs"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "discounts"}
              onClick={() => setActiveTab("discounts")}
              className={`px-3.5 py-2 border font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === "discounts"
                  ? "bg-bt-red border-bt-red text-white"
                  : "bg-bt-surface border-bt-border text-bt-muted hover:text-white hover:border-bt-red/60"
              }`}
            >
              <Flame className="w-4 h-4" />
              Popular Steam Discounts
              {discounts.length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-black/25">
                  {discounts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "wishlists"}
              onClick={() => setActiveTab("wishlists")}
              className={`px-3.5 py-2 border font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === "wishlists"
                  ? "bg-bt-red border-bt-red text-white"
                  : "bg-bt-surface border-bt-border text-bt-muted hover:text-white hover:border-bt-red/60"
              }`}
            >
              <Gift className="w-4 h-4" />
              Family Wishlists
              {wishlists.length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-black/25">
                  {wishlists.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "starred"}
              onClick={() => setActiveTab("starred")}
              className={`px-3.5 py-2 border font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === "starred"
                  ? "bg-bt-red border-bt-red text-white"
                  : "bg-bt-surface border-bt-border text-bt-muted hover:text-white hover:border-bt-red/60"
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  activeTab === "starred"
                    ? "fill-white text-white"
                    : "text-amber-400"
                }`}
              />
              Starred ({starredGames.length})
            </button>
          </div>

          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim">
            CLICK ANY CARD TO INSPECT // {regionInfo.code.toUpperCase()}
          </span>
        </div>

        {/* Tab 1: Popular Steam Discounts */}
        {activeTab === "discounts" && (
          <div className="space-y-4">
            {discountsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-bt-muted">
                <Loader2 className="w-6 h-6 animate-spin text-bt-red" />
                <span className="font-mono text-xs uppercase tracking-wider">
                  Fetching live Steam discounts ({regionInfo.code.toUpperCase()})...
                </span>
              </div>
            ) : discountsError ? (
              <div className="border border-bt-red/50 bg-bt-red/10 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-red-200">
                  <XCircle className="w-4 h-4 text-bt-red shrink-0" />
                  <span>{discountsError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchDiscounts(region)}
                  className="px-3 py-1.5 bg-bt-surface border border-bt-border hover:border-bt-red font-mono text-xs uppercase tracking-wider text-white cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : discounts.length === 0 ? (
              <div className="border border-bt-border bg-bt-surface/60 p-8 text-center text-sm text-bt-muted">
                No discounted Steam titles found for {regionInfo.label} right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {discounts.map((item) => (
                  <BrowseGameCard
                    key={item.appid}
                    game={item}
                    isStarred={starredAppIds.has(item.appid)}
                    claim={claimedGames[String(item.appid)]}
                    owners={ownedByAppId.get(item.appid) ?? []}
                    isSelected={result?.appid === item.appid}
                    onInspect={inspectFromBrowser}
                    onToggleStar={toggleStar}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Family Wishlists */}
        {activeTab === "wishlists" && (
          <div className="space-y-4">
            {wishlistPrivateMembers.length > 0 && (
              <div className="border border-bt-border bg-bt-surface/70 px-3.5 py-2.5 flex items-center gap-2 text-xs font-mono text-bt-muted">
                <Lock className="w-3.5 h-3.5 text-bt-dim shrink-0" />
                <span>
                  Private or empty Steam wishlist:{" "}
                  <span className="text-white">
                    {wishlistPrivateMembers.join(", ")}
                  </span>
                </span>
              </div>
            )}

            {activeLibraries.length === 0 ? (
              <div className="border border-bt-border bg-bt-surface/60 p-8 text-center text-sm text-bt-muted">
                Add active family members to compare Steam wishlists.
              </div>
            ) : wishlistsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-bt-muted">
                <Loader2 className="w-6 h-6 animate-spin text-bt-red" />
                <span className="font-mono text-xs uppercase tracking-wider">
                  Scanning family Steam wishlists...
                </span>
              </div>
            ) : wishlistsError ? (
              <div className="border border-bt-red/50 bg-bt-red/10 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-red-200">
                  <XCircle className="w-4 h-4 text-bt-red shrink-0" />
                  <span>{wishlistsError}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void fetchWishlists(region, wishlistMembersPayload)
                  }
                  className="px-3 py-1.5 bg-bt-surface border border-bt-border hover:border-bt-red font-mono text-xs uppercase tracking-wider text-white cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : wishlists.length === 0 ? (
              <div className="border border-bt-border bg-bt-surface/60 p-8 text-center text-sm text-bt-muted">
                No public wishlist games found across your active family members.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {wishlists.map((item) => (
                  <BrowseGameCard
                    key={item.appid}
                    game={item}
                    isStarred={starredAppIds.has(item.appid)}
                    claim={claimedGames[String(item.appid)]}
                    owners={ownedByAppId.get(item.appid) ?? []}
                    isSelected={result?.appid === item.appid}
                    wishedBy={item.wishedBy}
                    wishCount={item.wishCount}
                    onInspect={inspectFromBrowser}
                    onToggleStar={toggleStar}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Starred */}
        {activeTab === "starred" && (
          <div className="space-y-4">
            {starredGames.length === 0 ? (
              <div className="border border-bt-border bg-bt-surface/60 p-8 text-center space-y-2">
                <div className="flex justify-center">
                  <Star className="w-6 h-6 text-amber-400/70" />
                </div>
                <div className="text-sm text-bt-muted">
                  No starred games yet. Click the{" "}
                  <span className="text-amber-300 font-semibold">★</span> button
                  on any game to bookmark it for later.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {starredGames.map((item) => (
                  <BrowseGameCard
                    key={item.appid}
                    game={item}
                    isStarred={true}
                    claim={claimedGames[String(item.appid)]}
                    owners={ownedByAppId.get(item.appid) ?? []}
                    isSelected={result?.appid === item.appid}
                    onInspect={inspectFromBrowser}
                    onToggleStar={toggleStar}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
