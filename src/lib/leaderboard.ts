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

export type AchievementCategory = "volume" | "efficiency" | "playtime" | "squad";

export interface AchievementHolder {
  memberId: string;
  name: string;
  personaName: string;
  avatarUrl: string;
  statText: string;
  subText?: string;
}

export interface FamilyAchievement {
  id: string;
  title: string;
  subtitle: string;
  category: AchievementCategory;
  accent?: "crimson" | "gold" | "emerald" | "sky" | "amber";
  winner: AchievementHolder | null;
  runnerUp: { name: string; statText: string } | null;
}

export interface MemberTrophySummary {
  memberId: string;
  name: string;
  personaName: string;
  avatarUrl: string;
  role: "ACTIVE" | "WAITLIST";
  trophies: Array<{ id: string; title: string; accent: NonNullable<FamilyAchievement["accent"]> }>;
}

export function buildFamilyAchievements(
  analysis: FamilyAnalysis,
  activeLibraries: MemberLibrary[],
  waitlistSummaries: WaitlistLibrarySummary[],
  rankings: PowerRankingEntry[],
  formatMoney: (val: number) => string,
  includeExcluded = false
): {
  achievements: FamilyAchievement[];
  trophyCounts: MemberTrophySummary[];
} {
  const libByMemberId = new Map<string, MemberLibrary>();
  for (const lib of activeLibraries) {
    libByMemberId.set(lib.member.id, lib);
  }

  const activeRankings = rankings.filter((r) => r.role === "ACTIVE");
  const activeMembers = analysis.members;

  const toHolder = (
    m: { memberId: string; name: string; personaName?: string; avatarUrl?: string },
    statText: string,
    subText?: string
  ): AchievementHolder => ({
    memberId: m.memberId,
    name: m.name,
    personaName: m.personaName || m.name,
    avatarUrl: m.avatarUrl || libByMemberId.get(m.memberId)?.avatarUrl || "",
    statText,
    subText,
  });

  // 1. High Roller (Avg $/game, prefers 5+ games so everyone has a shot)
  const highRollerPool = activeRankings.filter((r) => r.totalGames >= 5);
  const highRollerSorted = [
    ...(highRollerPool.length > 0 ? highRollerPool : activeRankings),
  ].sort((a, b) => b.avgGameValue - a.avgGameValue || b.totalRawValue - a.totalRawValue);

  // 2. Purist (Highest Exclusivity %, min 3 games)
  const puristPool = activeRankings.filter((r) => r.totalGames >= 3);
  const puristSorted = [
    ...(puristPool.length > 0 ? puristPool : activeRankings),
  ].sort((a, b) => b.exclusivityPct - a.exclusivityPct || b.exclusiveGames - a.exclusiveGames);

  // 3. Team Player (Highest Shared %, min 3 games)
  const teamPlayerData = activeMembers
    .map((m) => ({
      memberId: m.memberId,
      name: m.name,
      personaName: m.personaName,
      avatarUrl: m.avatarUrl,
      totalGames: m.totalGames,
      sharedGames: m.sharedGames,
      sharedPct: m.totalGames > 0 ? Math.round((m.sharedGames / m.totalGames) * 1000) / 10 : 0,
    }))
    .filter((m) => m.totalGames >= 3 && m.sharedGames > 0)
    .sort((a, b) => b.sharedPct - a.sharedPct || b.sharedGames - a.sharedGames);

  // 4. Crown Jewel (Single most expensive game owned)
  const crownJewelData = activeMembers
    .map((m) => {
      const lib = libByMemberId.get(m.memberId);
      const games = (lib?.games ?? []).filter(
        (g) => (includeExcluded || !g.familySharingExcluded) && !g.isFree && g.rawPrice > 0
      );
      const top = [...games].sort((a, b) => b.rawPrice - a.rawPrice)[0];
      return top
        ? {
            memberId: m.memberId,
            name: m.name,
            personaName: m.personaName,
            avatarUrl: m.avatarUrl,
            gameName: top.name,
            price: top.rawPrice,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));

  // 5. Playtime stats (No-Lifer total hours & One-Trick single game hours)
  const playtimeData = activeMembers
    .map((m) => {
      const lib = libByMemberId.get(m.memberId);
      const games = (lib?.games ?? []).filter(
        (g) => includeExcluded || !g.familySharingExcluded
      );
      let totalMins = 0;
      let topGame: { name: string; mins: number } | null = null;
      for (const g of games) {
        const mins = g.playtimeMinutes ?? 0;
        totalMins += mins;
        if (!topGame || mins > topGame.mins) {
          topGame = { name: g.name, mins };
        }
      }
      return {
        memberId: m.memberId,
        name: m.name,
        personaName: m.personaName,
        avatarUrl: m.avatarUrl,
        totalHours: Math.round((totalMins / 60) * 10) / 10,
        topGameName: topGame?.name ?? "",
        topGameHours: topGame ? Math.round((topGame.mins / 60) * 10) / 10 : 0,
      };
    });

  const noLiferSorted = [...playtimeData]
    .filter((p) => p.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  const oneTrickSorted = [...playtimeData]
    .filter((p) => p.topGameHours > 0)
    .sort((a, b) => b.topGameHours - a.topGameHours);

  // 6. Heavyweights (Whale, Library King, Exclusive Dealer)
  const whaleSorted = [...activeMembers].sort(
    (a, b) => b.totalRawValue - a.totalRawValue || b.totalGames - a.totalGames
  );
  const kingSorted = [...activeMembers].sort(
    (a, b) => b.totalGames - a.totalGames || b.totalRawValue - a.totalRawValue
  );
  const exclusiveSorted = [...activeMembers].sort(
    (a, b) => b.exclusiveGames - a.exclusiveGames || b.exclusiveValue - a.exclusiveValue
  );

  // 7. Target Locked (Most behind avg)
  const targetLockedSorted = analysis.fairness.members
    .filter((m) => m.deltaFromAverageValue < -0.005)
    .sort((a, b) => a.deltaFromAverageValue - b.deltaFromAverageValue);

  // 8. Waitlist Challenger
  const waitlistSorted = [...waitlistSummaries].sort(
    (a, b) => b.netNewValue - a.netNewValue || b.totalRawValue - a.totalRawValue
  );

  const achievements: FamilyAchievement[] = [
    {
      id: "high-roller",
      title: "HIGH ROLLER",
      subtitle: "Highest Avg Price / Game",
      category: "efficiency",
      accent: "gold",
      winner: highRollerSorted[0]
        ? toHolder(
            highRollerSorted[0],
            `${formatMoney(highRollerSorted[0].avgGameValue)}/gm`,
            `${highRollerSorted[0].totalGames} games`
          )
        : null,
      runnerUp: highRollerSorted[1]
        ? {
            name: highRollerSorted[1].name,
            statText: `${formatMoney(highRollerSorted[1].avgGameValue)}/gm`,
          }
        : null,
    },
    {
      id: "purist",
      title: "PURIST",
      subtitle: "Highest Exclusivity Rate",
      category: "efficiency",
      accent: "emerald",
      winner: puristSorted[0]
        ? toHolder(
            puristSorted[0],
            `${puristSorted[0].exclusivityPct.toFixed(1)}%`,
            `${puristSorted[0].exclusiveGames}/${puristSorted[0].totalGames} unique`
          )
        : null,
      runnerUp: puristSorted[1]
        ? {
            name: puristSorted[1].name,
            statText: `${puristSorted[1].exclusivityPct.toFixed(1)}%`,
          }
        : null,
    },
    {
      id: "crown-jewel",
      title: "CROWN JEWEL",
      subtitle: "Single Priciest Game",
      category: "efficiency",
      accent: "gold",
      winner: crownJewelData[0]
        ? toHolder(
            crownJewelData[0],
            formatMoney(crownJewelData[0].price),
            crownJewelData[0].gameName
          )
        : null,
      runnerUp: crownJewelData[1]
        ? {
            name: crownJewelData[1].name,
            statText: `${formatMoney(crownJewelData[1].price)} (${crownJewelData[1].gameName})`,
          }
        : null,
    },
    {
      id: "team-player",
      title: "TEAM PLAYER",
      subtitle: "Highest Squad Overlap %",
      category: "squad",
      accent: "sky",
      winner: teamPlayerData[0]
        ? toHolder(
            teamPlayerData[0],
            `${teamPlayerData[0].sharedPct.toFixed(1)}%`,
            `${teamPlayerData[0].sharedGames}/${teamPlayerData[0].totalGames} shared`
          )
        : null,
      runnerUp: teamPlayerData[1]
        ? {
            name: teamPlayerData[1].name,
            statText: `${teamPlayerData[1].sharedPct.toFixed(1)}%`,
          }
        : null,
    },
    {
      id: "no-lifer",
      title: "NO-LIFER",
      subtitle: "Most Total Hours Played",
      category: "playtime",
      accent: "crimson",
      winner: noLiferSorted[0]
        ? toHolder(
            noLiferSorted[0],
            `${noLiferSorted[0].totalHours.toLocaleString()}h`,
            "total playtime"
          )
        : null,
      runnerUp: noLiferSorted[1]
        ? {
            name: noLiferSorted[1].name,
            statText: `${noLiferSorted[1].totalHours.toLocaleString()}h`,
          }
        : null,
    },
    {
      id: "one-trick",
      title: "ONE-TRICK",
      subtitle: "Most Hours on 1 Game",
      category: "playtime",
      accent: "amber",
      winner: oneTrickSorted[0]
        ? toHolder(
            oneTrickSorted[0],
            `${oneTrickSorted[0].topGameHours.toLocaleString()}h`,
            oneTrickSorted[0].topGameName
          )
        : null,
      runnerUp: oneTrickSorted[1]
        ? {
            name: oneTrickSorted[1].name,
            statText: `${oneTrickSorted[1].topGameHours.toLocaleString()}h (${oneTrickSorted[1].topGameName})`,
          }
        : null,
    },
    {
      id: "biggest-whale",
      title: "BIGGEST WHALE",
      subtitle: "Highest Raw Catalog Value",
      category: "volume",
      accent: "crimson",
      winner: whaleSorted[0]
        ? toHolder(
            whaleSorted[0],
            formatMoney(whaleSorted[0].totalRawValue),
            `${whaleSorted[0].sharePercent.toFixed(1)}% family share`
          )
        : null,
      runnerUp: whaleSorted[1]
        ? {
            name: whaleSorted[1].name,
            statText: formatMoney(whaleSorted[1].totalRawValue),
          }
        : null,
    },
    {
      id: "library-king",
      title: "LIBRARY KING",
      subtitle: "Most Shareable Games",
      category: "volume",
      accent: "sky",
      winner: kingSorted[0]
        ? toHolder(
            kingSorted[0],
            `${kingSorted[0].totalGames.toLocaleString()} games`,
            `${kingSorted[0].exclusiveGames} exclusive`
          )
        : null,
      runnerUp: kingSorted[1]
        ? {
            name: kingSorted[1].name,
            statText: `${kingSorted[1].totalGames.toLocaleString()} games`,
          }
        : null,
    },
    {
      id: "exclusive-dealer",
      title: "EXCLUSIVE DEALER",
      subtitle: "Most Unique-to-Family Games",
      category: "volume",
      accent: "emerald",
      winner: exclusiveSorted[0]
        ? toHolder(
            exclusiveSorted[0],
            `${exclusiveSorted[0].exclusiveGames.toLocaleString()} excl.`,
            `${formatMoney(exclusiveSorted[0].exclusiveValue)} solo value`
          )
        : null,
      runnerUp: exclusiveSorted[1]
        ? {
            name: exclusiveSorted[1].name,
            statText: `${exclusiveSorted[1].exclusiveGames.toLocaleString()} excl.`,
          }
        : null,
    },
    {
      id: "target-locked",
      title: "TARGET LOCKED",
      subtitle: "Up Next to Buy",
      category: "squad",
      accent: "crimson",
      winner: targetLockedSorted[0]
        ? toHolder(
            {
              memberId: targetLockedSorted[0].memberId,
              name: targetLockedSorted[0].name,
            },
            `-${formatMoney(Math.abs(targetLockedSorted[0].deltaFromAverageValue))}`,
            `${targetLockedSorted[0].sharePercent.toFixed(1)}% vs ${targetLockedSorted[0].expectedSharePercent.toFixed(1)}% avg`
          )
        : null,
      runnerUp: targetLockedSorted[1]
        ? {
            name: targetLockedSorted[1].name,
            statText: `-${formatMoney(Math.abs(targetLockedSorted[1].deltaFromAverageValue))}`,
          }
        : null,
    },
  ];

  if (waitlistSorted[0]) {
    achievements.push({
      id: "waitlist-challenger",
      title: "BENCH MVP",
      subtitle: "Top Net-New Waitlist Pick",
      category: "squad",
      accent: "amber",
      winner: {
        memberId: waitlistSorted[0].lib.member.id,
        name: waitlistSorted[0].lib.member.name,
        personaName: waitlistSorted[0].lib.personaName || waitlistSorted[0].lib.member.name,
        avatarUrl: waitlistSorted[0].lib.avatarUrl,
        statText: `+${formatMoney(waitlistSorted[0].netNewValue)}`,
        subText: `+${waitlistSorted[0].exclusiveGames} new games`,
      },
      runnerUp: waitlistSorted[1]
        ? {
            name: waitlistSorted[1].lib.member.name,
            statText: `+${formatMoney(waitlistSorted[1].netNewValue)}`,
          }
        : null,
    });
  }

  // Build per-member Trophy Count showcase (everyone in rankings appears so you can see who holds what!)
  const trophyMap = new Map<string, MemberTrophySummary>();
  for (const r of rankings) {
    trophyMap.set(r.memberId, {
      memberId: r.memberId,
      name: r.name,
      personaName: r.personaName,
      avatarUrl: r.avatarUrl,
      role: r.role,
      trophies: [],
    });
  }

  for (const ach of achievements) {
    if (!ach.winner || ach.id === "target-locked") continue;
    const holder = trophyMap.get(ach.winner.memberId);
    if (holder) {
      holder.trophies.push({
        id: ach.id,
        title: ach.title,
        accent: ach.accent ?? "crimson",
      });
    }
  }

  const trophyCounts = Array.from(trophyMap.values()).sort(
    (a, b) => b.trophies.length - a.trophies.length || a.name.localeCompare(b.name)
  );

  return { achievements, trophyCounts };
}
