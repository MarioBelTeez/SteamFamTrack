import type {
  FamilyAnalysis,
  MemberLibrary,
  SteamRegion,
} from "./types";

export type TierGrade = "S" | "A" | "B" | "C";

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
  sharePercent: number | null;
  powerScore: number;
  tier: TierGrade;
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

export function buildPowerRankings(
  analysis: FamilyAnalysis,
  waitlistSummaries: WaitlistLibrarySummary[],
  memberIdentityById: Map<
    string,
    { avatarUrl: string; personaName: string; steamId64: string; name: string }
  >,
  region: SteamRegion
): PowerRankingEntry[] {
  const rawEntries: Array<Omit<PowerRankingEntry, "tier">> = [
    ...analysis.members.map((m) => {
      const fallback = memberIdentityById.get(m.memberId);
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
        sharePercent: m.sharePercent,
        powerScore: computePowerScore(
          m.totalRawValue,
          m.exclusiveGames,
          m.totalGames,
          region
        ),
      };
    }),
    ...waitlistSummaries.map((w) => ({
      memberId: w.lib.member.id,
      name: w.lib.member.name,
      personaName: w.lib.personaName || w.lib.member.name,
      avatarUrl: w.lib.avatarUrl,
      steamId64: w.lib.steamId64,
      role: "WAITLIST" as const,
      totalGames: w.totalGames,
      exclusiveGames: w.exclusiveGames,
      totalRawValue: w.totalRawValue,
      sharePercent: null,
      powerScore: computePowerScore(
        w.totalRawValue,
        w.exclusiveGames,
        w.totalGames,
        region
      ),
    })),
  ];

  rawEntries.sort(
    (a, b) =>
      b.powerScore - a.powerScore ||
      b.totalRawValue - a.totalRawValue ||
      a.name.localeCompare(b.name)
  );

  const maxScore = rawEntries[0]?.powerScore ?? 0;

  return rawEntries.map((entry) => ({
    ...entry,
    tier: assignTierGrade(entry.powerScore, maxScore),
  }));
}
