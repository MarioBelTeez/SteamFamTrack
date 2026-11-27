import type {
  FamilyAnalysis,
  MemberLibrary,
  SteamRegion,
} from "./types";

export type TierGrade = "S" | "A" | "B" | "C";

export type LeaderboardSortKey =
  | "powerScore"
  | "totalRawValue"
  | "totalGames"
  | "exclusiveGames"
  | "exclusivityPct"
  | "avgGameValue"
  | "sharePercent";

export type SortDirection = "asc" | "desc";

export interface LeaderboardBadge {
  id: string;
  label: string;
  tone: "crimson" | "gold" | "emerald" | "sky" | "amber";
}

export interface PowerBreakdown {
  valuePoints: number;
  exclusivePoints: number;
  volumePoints: number;
}

/**
 * Approximate regional unit multiplier relative to USD so composite Power Score
 * balances Value + Exclusive Bonus + Library Size fairly across currencies
 * (e.g. ¥150 ≈ $1 so JPY raw values don't dwarf game counts by 150x).
 */
const REGION_TO_USD_SCALE: Record<SteamRegion, number> = {
  ma: 1,
  us: 1,
  eu: 1.08,
  gb: 1.27,
  br: 0.2,
  jp: 0.0067,
};

export interface WaitlistLibrarySummary {
  lib: MemberLibrary;
  totalGames: number;
  exclusiveGames: number;
  totalRawValue: number;
  netNewValue: number;
}

export interface PowerRankingEntry {
  memberId: string;
  name: string;
  personaName: string;
  avatarUrl: string;
  steamId64: string;
  role: "ACTIVE" | "WAITLIST";
  totalGames: number;
  exclusiveGames: number;
  totalRawValue: number;
  exclusiveValue: number;
  avgGameValue: number;
  exclusivityPct: number;
  sharePercent: number | null;
  powerScore: number;
  powerBreakdown: PowerBreakdown;
  tier: TierGrade;
  badges: LeaderboardBadge[];
}

export function computePowerBreakdown(
  totalRawValue: number,
  exclusiveGames: number,
  totalGames: number,
  region: SteamRegion = "us"
): PowerBreakdown {
  const normalizedValue = totalRawValue * (REGION_TO_USD_SCALE[region] ?? 1);
  return {
    valuePoints: Math.round(normalizedValue),
    exclusivePoints: Math.round(exclusiveGames * 5),
    volumePoints: Math.round(totalGames * 0.5),
  };
}

export function computePowerScore(
  totalRawValue: number,
  exclusiveGames: number,
  totalGames: number,
  region: SteamRegion = "us"
): number {
  const normalizedValue = totalRawValue * (REGION_TO_USD_SCALE[region] ?? 1);
  return Math.round(normalizedValue + exclusiveGames * 5 + totalGames * 0.5);
}

export function assignTierGrade(score: number, maxScore: number): TierGrade {
  if (maxScore <= 0 || score <= 0) return "C";
  const ratio = score / maxScore;
  if (ratio >= 0.85) return "S";
  if (ratio >= 0.6) return "A";
  if (ratio >= 0.35) return "B";
  return "C";
}

export function summarizeWaitlistLibrary(
  lib: MemberLibrary,
  activeAppIds: Set<number>,
  includeExcluded: boolean = false
): Omit<WaitlistLibrarySummary, "lib"> {
  let totalGames = 0;
  let exclusiveGames = 0;
  let totalRawValue = 0;
  let netNewValue = 0;
  const seen = new Set<number>();

  for (const game of lib.games) {
    if (!includeExcluded && game.familySharingExcluded) continue;
    if (seen.has(game.appid)) continue;
    seen.add(game.appid);

    totalGames += 1;
    totalRawValue += game.rawPrice;
    if (!activeAppIds.has(game.appid)) {
      exclusiveGames += 1;
      netNewValue += game.rawPrice;
    }
  }

  return {
    totalGames,
    exclusiveGames,
    totalRawValue: Math.round(totalRawValue * 100) / 100,
    netNewValue: Math.round(netNewValue * 100) / 100,
  };
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

export function buildPowerRankings(
  analysis: FamilyAnalysis,
  waitlistSummaries: WaitlistLibrarySummary[],
  memberIdentityById: Map<
    string,
    { avatarUrl: string; personaName: string; steamId64: string; name: string }
  >,
  region: SteamRegion
): PowerRankingEntry[] {
  const rawEntries: Array<Omit<PowerRankingEntry, "tier" | "badges">> = [
    ...analysis.members.map((m) => {
      const fallback = memberIdentityById.get(m.memberId);
      const avgGameValue = m.totalGames > 0 ? roundTwo(m.totalRawValue / m.totalGames) : 0;
      const exclusivityPct =
        m.totalGames > 0 ? Math.round((m.exclusiveGames / m.totalGames) * 1000) / 10 : 0;
      return {
        memberId: m.memberId,
        name: m.name,
        personaName: m.personaName || fallback?.personaName || m.name,
        avatarUrl: m.avatarUrl || fallback?.avatarUrl || "",
        steamId64: m.steamId64 || fallback?.steamId64 || "",
        role: "ACTIVE" as const,
        totalGames: m.totalGames,
        exclusiveGames: m.exclusiveGames,
        totalRawValue: m.totalRawValue,
        exclusiveValue: m.exclusiveValue,
        avgGameValue,
        exclusivityPct,
        sharePercent: m.sharePercent,
        powerScore: computePowerScore(
          m.totalRawValue,
          m.exclusiveGames,
          m.totalGames,
          region
        ),
        powerBreakdown: computePowerBreakdown(
          m.totalRawValue,
          m.exclusiveGames,
          m.totalGames,
          region
        ),
      };
    }),
    ...waitlistSummaries.map((w) => {
      const avgGameValue = w.totalGames > 0 ? roundTwo(w.totalRawValue / w.totalGames) : 0;
      const exclusivityPct =
        w.totalGames > 0 ? Math.round((w.exclusiveGames / w.totalGames) * 1000) / 10 : 0;
      return {
        memberId: w.lib.member.id,
        name: w.lib.member.name,
        personaName: w.lib.personaName || w.lib.member.name,
        avatarUrl: w.lib.avatarUrl,
        steamId64: w.lib.steamId64,
        role: "WAITLIST" as const,
        totalGames: w.totalGames,
        exclusiveGames: w.exclusiveGames,
        totalRawValue: w.totalRawValue,
        exclusiveValue: w.netNewValue,
        avgGameValue,
        exclusivityPct,
        sharePercent: null,
        powerScore: computePowerScore(
          w.totalRawValue,
          w.exclusiveGames,
          w.totalGames,
          region
        ),
        powerBreakdown: computePowerBreakdown(
          w.totalRawValue,
          w.exclusiveGames,
          w.totalGames,
          region
        ),
      };
    }),
  ];

  rawEntries.sort(
    (a, b) =>
      b.powerScore - a.powerScore ||
      b.totalRawValue - a.totalRawValue ||
      a.name.localeCompare(b.name)
  );

  const maxScore = rawEntries[0]?.powerScore ?? 0;

  // Determine badge holders
  const activeEntries = rawEntries.filter((e) => e.role === "ACTIVE");
  const waitlistEntries = rawEntries.filter((e) => e.role === "WAITLIST");

  const whaleId =
    [...activeEntries].sort((a, b) => b.totalRawValue - a.totalRawValue)[0]
      ?.memberId ?? null;
  const kingId =
    [...activeEntries].sort((a, b) => b.totalGames - a.totalGames)[0]
      ?.memberId ?? null;
  const exclusiveId =
    [...activeEntries].sort((a, b) => b.exclusiveGames - a.exclusiveGames)[0]
      ?.memberId ?? null;
  const highRollerPool = activeEntries.filter((e) => e.totalGames >= 5);
  const highRollerCandidates = highRollerPool.length > 0 ? highRollerPool : activeEntries;
  const highRollerId =
    [...highRollerCandidates].sort((a, b) => b.avgGameValue - a.avgGameValue)[0]
      ?.memberId ?? null;
  const topBenchId =
    [...waitlistEntries].sort((a, b) => b.exclusiveValue - a.exclusiveValue)[0]
      ?.memberId ?? null;
  const upNextId = analysis.fairness.upNextMemberId;

  return rawEntries.map((entry, index) => {
    const badges: LeaderboardBadge[] = [];
    if (index === 0 && entry.powerScore > 0) {
      badges.push({ id: "mvp", label: "#1 MVP", tone: "crimson" });
    }
    if (entry.role === "ACTIVE" && entry.memberId === whaleId && entry.totalRawValue > 0) {
      badges.push({ id: "whale", label: "WHALE", tone: "gold" });
    }
    if (entry.role === "ACTIVE" && entry.memberId === kingId && entry.totalGames > 0) {
      badges.push({ id: "library-king", label: "LIB KING", tone: "sky" });
    }
    if (entry.role === "ACTIVE" && entry.memberId === exclusiveId && entry.exclusiveGames > 0) {
      badges.push({ id: "exclusive", label: "SOLO DEALER", tone: "emerald" });
    }
    if (
      entry.role === "ACTIVE" &&
      entry.memberId === highRollerId &&
      entry.avgGameValue > 0 &&
      entry.memberId !== whaleId
    ) {
      badges.push({ id: "high-roller", label: "HIGH ROLLER", tone: "gold" });
    }
    if (entry.role === "ACTIVE" && entry.memberId === upNextId) {
      badges.push({ id: "up-next", label: "UP NEXT", tone: "crimson" });
    }
    if (entry.role === "WAITLIST" && entry.memberId === topBenchId && entry.exclusiveValue > 0) {
      badges.push({ id: "bench-mvp", label: "BENCH MVP", tone: "amber" });
    }

    return {
      ...entry,
      tier: assignTierGrade(entry.powerScore, maxScore),
      badges: badges.slice(0, 3),
    };
  });
}

export function sortPowerRankings(
  entries: PowerRankingEntry[],
  sortKey: LeaderboardSortKey,
  direction: SortDirection = "desc"
): PowerRankingEntry[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const aVal = a[sortKey] ?? -1;
    const bVal = b[sortKey] ?? -1;
    if (aVal !== bVal) {
      return (aVal - bVal) * dir;
    }
    return b.powerScore - a.powerScore || a.name.localeCompare(b.name);
  });
}
