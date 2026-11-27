"use client";

import { useMemo, useState } from "react";
import {
  buildPowerRankings,
  sortPowerRankings,
  summarizeWaitlistLibrary,
  type LeaderboardBadge,
  type LeaderboardSortKey,
  type PowerRankingEntry,
  type SortDirection,
  type TierGrade,
} from "@/lib/leaderboard";
import {
  FamilyAnalysis,
  MemberLibrary,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  Crosshair,
  Crown,
  Flame,
  Gem,
  HeartHandshake,
  Library,
  Sparkles,
  Swords,
  Trophy,
  UserX,
} from "lucide-react";

interface FamilyLeaderboardProps {
  analysis: FamilyAnalysis;
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
  includeExcluded?: boolean;
}

interface AwardCardData {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  winnerName: string;
  winnerPersona?: string;
  avatarUrl: string;
  statValue: string;
  statLabel: string;
  accent?: "crimson" | "default";
  emptyMessage?: string;
  icon: typeof Crown;
}

type RoleFilter = "ALL" | "ACTIVE" | "WAITLIST";

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "??";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function formatMoney(val: number, region: SteamRegion): string {
  const sym = STEAM_REGIONS[region].symbol;
  if (region === "jp") {
    return `${sym}${Math.round(val).toLocaleString()}`;
  }
  return `${sym}${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMoney(val: number, region: SteamRegion): string {
  if (Math.abs(val) < 0.005) {
    return formatMoney(0, region);
  }
  const sign = val > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(val), region)}`;
}

interface MemberAvatarProps {
  avatarUrl: string;
  name: string;
  highlighted?: boolean;
  size?: "sm" | "md" | "lg";
}

function MemberAvatar({
  avatarUrl,
  name,
  highlighted = false,
  size = "sm",
}: MemberAvatarProps) {
  const dimensions =
    size === "lg" ? "h-14 w-14" : size === "md" ? "h-12 w-12" : "h-8 w-8";
  const borderColor = highlighted ? "border-bt-red" : "border-bt-border";
  const textClass =
    size === "lg"
      ? `font-display text-xl tracking-wider ${highlighted ? "text-bt-red" : "text-white"}`
      : size === "md"
        ? `font-display text-lg tracking-wider ${highlighted ? "text-bt-red" : "text-white"}`
        : `font-display text-sm tracking-wider ${highlighted ? "text-bt-red" : "text-white"}`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${dimensions} shrink-0 object-cover border ${borderColor}`}
      />
    );
  }

  return (
    <div
      className={`${dimensions} shrink-0 border ${borderColor} bg-bt-elevated flex items-center justify-center ${textClass}`}
    >
      {getInitials(name)}
    </div>
  );
}

const TIER_STYLES: Record<TierGrade, string> = {
  S: "bg-bt-red text-white",
  A: "bg-amber-400/15 text-amber-300 border border-amber-400/45",
  B: "bg-sky-400/15 text-sky-300 border border-sky-400/40",
  C: "bg-bt-elevated text-bt-muted border border-bt-border",
};

const BADGE_TONE_STYLES: Record<LeaderboardBadge["tone"], string> = {
  crimson: "border-bt-red/50 bg-bt-red/15 text-bt-red",
  gold: "border-amber-400/45 bg-amber-400/10 text-amber-300",
  emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  sky: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

function SortHeaderButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: LeaderboardSortKey;
  activeKey: LeaderboardSortKey;
  direction: SortDirection;
  onSort: (key: LeaderboardSortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
        align === "right" ? "justify-end w-full" : "justify-start"
      } ${isActive ? "text-bt-red font-bold" : "text-bt-muted hover:text-white"}`}
    >
      <span>{label}</span>
      {isActive ? (
        direction === "desc" ? (
          <ArrowDown className="h-3 w-3 shrink-0" />
        ) : (
          <ArrowUp className="h-3 w-3 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-45" />
      )}
    </button>
  );
}

/**
 * Persona 5-styled Family Power Rankings, Top-3 Podium, Head-to-Head & Hall of Fame Awards.
 */
export function FamilyLeaderboard({
  analysis,
  activeLibraries,
  waitlistLibraries,
  region,
  includeExcluded = false,
}: FamilyLeaderboardProps) {
  const regionConfig = STEAM_REGIONS[region];
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>("powerScore");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLeftKey, setCompareLeftKey] = useState<string>("");
  const [compareRightKey, setCompareRightKey] = useState<string>("");

  const memberIdentityById = useMemo(() => {
    const map = new Map<
      string,
      { avatarUrl: string; personaName: string; steamId64: string; name: string }
    >();

    for (const lib of activeLibraries) {
      map.set(lib.member.id, {
        avatarUrl: lib.avatarUrl,
        personaName: lib.personaName,
        steamId64: lib.steamId64,
        name: lib.member.name,
      });
    }

    for (const m of analysis.members) {
      const existing = map.get(m.memberId);
      map.set(m.memberId, {
        avatarUrl: m.avatarUrl || existing?.avatarUrl || "",
        personaName: m.personaName || existing?.personaName || m.name,
        steamId64: m.steamId64 || existing?.steamId64 || "",
        name: m.name,
      });
    }

    return map;
  }, [activeLibraries, analysis.members]);

  const activeAppIds = useMemo(() => {
    const ids = new Set<number>();
    for (const entry of analysis.catalog) {
      ids.add(entry.game.appid);
    }
    if (ids.size === 0) {
      for (const lib of activeLibraries) {
        for (const g of lib.games) {
          if (includeExcluded || !g.familySharingExcluded) {
            ids.add(g.appid);
          }
        }
      }
    }
    return ids;
  }, [analysis.catalog, activeLibraries, includeExcluded]);

  const waitlistSummaries = useMemo(() => {
    return waitlistLibraries.map((lib) => {
      const stats = summarizeWaitlistLibrary(lib, activeAppIds, includeExcluded);
      return {
        lib,
        ...stats,
      };
    });
  }, [waitlistLibraries, activeAppIds, includeExcluded]);

  const rankings = useMemo(
    () =>
      buildPowerRankings(
        analysis,
        waitlistSummaries,
        memberIdentityById,
        region
      ),
    [analysis, waitlistSummaries, memberIdentityById, region]
  );

  const awards = useMemo<AwardCardData[]>(() => {
    const members = analysis.members;

    const biggestWhale =
      members.length > 0
        ? [...members].sort(
            (a, b) =>
              b.totalRawValue - a.totalRawValue ||
              b.totalGames - a.totalGames ||
              a.name.localeCompare(b.name)
          )[0]
        : null;

    const libraryKing =
      members.length > 0
        ? [...members].sort(
            (a, b) =>
              b.totalGames - a.totalGames ||
              b.totalRawValue - a.totalRawValue ||
              a.name.localeCompare(b.name)
          )[0]
        : null;

    const exclusiveDealer =
      members.length > 0
        ? [...members].sort(
            (a, b) =>
              b.exclusiveGames - a.exclusiveGames ||
              b.exclusiveValue - a.exclusiveValue ||
              a.name.localeCompare(b.name)
          )[0]
        : null;

    const soloCarry =
      members.length > 0
        ? [...members].sort(
            (a, b) =>
              b.exclusiveValue - a.exclusiveValue ||
              b.exclusiveGames - a.exclusiveGames ||
              a.name.localeCompare(b.name)
          )[0]
        : null;

    const activeRankings = rankings.filter((r) => r.role === "ACTIVE");
    const highRollerPool = activeRankings.filter((r) => r.totalGames >= 5);
    const highRollerCandidates =
      highRollerPool.length > 0 ? highRollerPool : activeRankings;
    const highRoller =
      highRollerCandidates.length > 0
        ? [...highRollerCandidates].sort(
            (a, b) =>
              b.avgGameValue - a.avgGameValue ||
              b.totalRawValue - a.totalRawValue ||
              a.name.localeCompare(b.name)
          )[0]
        : null;

    const fairnessMembers = analysis.fairness.members;

    const mostGenerous =
      fairnessMembers
        .filter((m) => m.deltaFromAverageValue > 0.005)
        .sort(
          (a, b) =>
            b.deltaFromAverageValue - a.deltaFromAverageValue ||
            a.name.localeCompare(b.name)
        )[0] ?? null;

    const targetLocked =
      fairnessMembers
        .filter((m) => m.deltaFromAverageValue < -0.005)
        .sort(
          (a, b) =>
            a.deltaFromAverageValue - b.deltaFromAverageValue ||
            (a.isUpNext === b.isUpNext ? 0 : a.isUpNext ? -1 : 1) ||
            a.name.localeCompare(b.name)
        )[0] ?? null;

    const topWaitlist =
      waitlistSummaries.length > 0
        ? [...waitlistSummaries].sort(
            (a, b) =>
              b.netNewValue - a.netNewValue ||
              b.totalRawValue - a.totalRawValue ||
              b.totalGames - a.totalGames ||
              a.lib.member.name.localeCompare(b.lib.member.name)
          )[0]
        : null;

    const mostGenerousIdentity = mostGenerous
      ? memberIdentityById.get(mostGenerous.memberId)
      : undefined;
    const targetLockedIdentity = targetLocked
      ? memberIdentityById.get(targetLocked.memberId)
      : undefined;

    return [
      {
        id: "biggest-whale",
        index: "AWARD 01",
        title: "BIGGEST WHALE",
        subtitle: "Highest Raw Catalog Value",
        winnerName: biggestWhale?.name ?? "—",
        winnerPersona:
          biggestWhale && biggestWhale.personaName !== biggestWhale.name
            ? biggestWhale.personaName
            : undefined,
        avatarUrl: biggestWhale?.avatarUrl ?? "",
        statValue: biggestWhale
          ? formatMoney(biggestWhale.totalRawValue, region)
          : "—",
        statLabel: biggestWhale
          ? `${biggestWhale.sharePercent.toFixed(1)}% FAMILY SHARE`
          : "NO ACTIVE MEMBERS",
        accent: "crimson",
        emptyMessage: biggestWhale ? undefined : "No active members",
        icon: Crown,
      },
      {
        id: "library-king",
        index: "AWARD 02",
        title: "LIBRARY KING",
        subtitle: "Most Shareable Games",
        winnerName: libraryKing?.name ?? "—",
        winnerPersona:
          libraryKing && libraryKing.personaName !== libraryKing.name
            ? libraryKing.personaName
            : undefined,
        avatarUrl: libraryKing?.avatarUrl ?? "",
        statValue: libraryKing
          ? `${libraryKing.totalGames.toLocaleString()} GAMES`
          : "—",
        statLabel: libraryKing
          ? `${libraryKing.sharedGames.toLocaleString()} SHARED · ${libraryKing.exclusiveGames.toLocaleString()} EXCL.`
          : "NO ACTIVE MEMBERS",
        emptyMessage: libraryKing ? undefined : "No active members",
        icon: Library,
      },
      {
        id: "exclusive-dealer",
        index: "AWARD 03",
        title: "EXCLUSIVE DEALER",
        subtitle: "Most Unique-to-Family Titles",
        winnerName: exclusiveDealer?.name ?? "—",
        winnerPersona:
          exclusiveDealer && exclusiveDealer.personaName !== exclusiveDealer.name
            ? exclusiveDealer.personaName
            : undefined,
        avatarUrl: exclusiveDealer?.avatarUrl ?? "",
        statValue: exclusiveDealer
          ? `${exclusiveDealer.exclusiveGames.toLocaleString()} EXCL.`
          : "—",
        statLabel: exclusiveDealer
          ? `${formatMoney(exclusiveDealer.exclusiveValue, region)} SOLO VALUE`
          : "NO ACTIVE MEMBERS",
        emptyMessage: exclusiveDealer ? undefined : "No active members",
        icon: Gem,
      },
      {
        id: "solo-carry",
        index: "AWARD 04",
        title: "SOLO CARRY",
        subtitle: "Highest Exclusive-Only Value",
        winnerName: soloCarry?.name ?? "—",
        winnerPersona:
          soloCarry && soloCarry.personaName !== soloCarry.name
            ? soloCarry.personaName
            : undefined,
        avatarUrl: soloCarry?.avatarUrl ?? "",
        statValue: soloCarry
          ? formatMoney(soloCarry.exclusiveValue, region)
          : "—",
        statLabel: soloCarry
          ? `${soloCarry.exclusiveGames.toLocaleString()} UNIQUE TITLES`
          : "NO ACTIVE MEMBERS",
        emptyMessage: soloCarry ? undefined : "No active members",
        icon: Flame,
      },
      {
        id: "high-roller",
        index: "AWARD 05",
        title: "HIGH ROLLER",
        subtitle: "Highest Avg Price / Game",
        winnerName: highRoller?.name ?? "—",
        winnerPersona:
          highRoller && highRoller.personaName !== highRoller.name
            ? highRoller.personaName
            : undefined,
        avatarUrl: highRoller?.avatarUrl ?? "",
        statValue: highRoller
          ? `${formatMoney(highRoller.avgGameValue, region)}/GM`
          : "—",
        statLabel: highRoller
          ? `${highRoller.totalGames.toLocaleString()} GAMES · ${formatMoney(highRoller.totalRawValue, region)}`
          : "NO ACTIVE MEMBERS",
        emptyMessage: highRoller ? undefined : "No active members",
        icon: Sparkles,
      },
      {
        id: "most-generous",
        index: "AWARD 06",
        title: "MOST GENEROUS",
        subtitle: "Top Surplus Above Group Avg",
        winnerName: mostGenerous?.name ?? "BALANCED",
        winnerPersona:
          mostGenerousIdentity &&
          mostGenerous &&
          mostGenerousIdentity.personaName !== mostGenerous.name
            ? mostGenerousIdentity.personaName
            : undefined,
        avatarUrl: mostGenerousIdentity?.avatarUrl ?? "",
        statValue: mostGenerous
          ? formatSignedMoney(mostGenerous.deltaFromAverageValue, region)
          : formatMoney(0, region),
        statLabel: mostGenerous
          ? `+${mostGenerous.deltaFromAveragePct.toFixed(1)}% VS AVG SHARE`
          : "NO POSITIVE DELTA",
        emptyMessage: mostGenerous ? undefined : "All members near average",
        icon: HeartHandshake,
      },
      {
        id: "target-locked",
        index: "AWARD 07",
        title: "TARGET LOCKED (UP NEXT)",
        subtitle: "Most Behind Group Average",
        winnerName:
          targetLocked?.name ?? (members.length > 0 ? "BALANCED" : "—"),
        winnerPersona:
          targetLockedIdentity &&
          targetLocked &&
          targetLockedIdentity.personaName !== targetLocked.name
            ? targetLockedIdentity.personaName
            : undefined,
        avatarUrl: targetLockedIdentity?.avatarUrl ?? "",
        statValue: targetLocked
          ? formatSignedMoney(targetLocked.deltaFromAverageValue, region)
          : members.length > 0
            ? formatMoney(0, region)
            : "—",
        statLabel: targetLocked
          ? `${targetLocked.sharePercent.toFixed(1)}% OF ${targetLocked.expectedSharePercent.toFixed(1)}% TARGET`
          : members.length > 0
            ? "NO DEFICIT DETECTED"
            : "NO ACTIVE MEMBERS",
        accent: "crimson",
        emptyMessage: targetLocked
          ? undefined
          : members.length > 0
            ? "All members near average"
            : "No active members",
        icon: Crosshair,
      },
      {
        id: "waitlist-challenger",
        index: "AWARD 08",
        title: "WAITLIST CHALLENGER",
        subtitle: "Strongest Net-New Bench Pick",
        winnerName: topWaitlist ? topWaitlist.lib.member.name : "No Waitlist",
        winnerPersona:
          topWaitlist &&
          topWaitlist.lib.personaName !== topWaitlist.lib.member.name
            ? topWaitlist.lib.personaName
            : undefined,
        avatarUrl: topWaitlist?.lib.avatarUrl ?? "",
        statValue: topWaitlist
          ? `+${formatMoney(topWaitlist.netNewValue, region)}`
          : "0 CANDIDATES",
        statLabel: topWaitlist
          ? `+${topWaitlist.exclusiveGames.toLocaleString()} NEW · ${formatMoney(topWaitlist.totalRawValue, region)} TOTAL`
          : "ADD WAITLIST TO COMPARE",
        emptyMessage: topWaitlist ? undefined : "No Waitlist",
        icon: Swords,
      },
    ];
  }, [
    analysis.members,
    analysis.fairness.members,
    rankings,
    waitlistSummaries,
    memberIdentityById,
    region,
  ]);

  const maxPowerScore = rankings[0]?.powerScore ?? 0;

  const overallRankByKey = useMemo(() => {
    const map = new Map<string, number>();
    rankings.forEach((entry, idx) => {
      map.set(`${entry.role}-${entry.memberId}`, idx + 1);
    });
    return map;
  }, [rankings]);

  const displayedRankings = useMemo(() => {
    const filtered =
      roleFilter === "ALL"
        ? rankings
        : rankings.filter((r) => r.role === roleFilter);
    return sortPowerRankings(filtered, sortKey, sortDir);
  }, [rankings, roleFilter, sortKey, sortDir]);

  const handleSort = (nextKey: LeaderboardSortKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  };

  const podiumTopThree = useMemo(() => {
    if (rankings.length < 2) return [];
    const first = rankings[0];
    const second = rankings[1];
    const third = rankings[2];
    if (third) {
      // Visual podium order: #2 left, #1 center, #3 right
      return [
        { entry: second, rank: 2, orderClass: "md:order-1 md:mt-5" },
        { entry: first, rank: 1, orderClass: "md:order-2" },
        { entry: third, rank: 3, orderClass: "md:order-3 md:mt-7" },
      ];
    }
    return [
      { entry: second, rank: 2, orderClass: "md:order-1 md:mt-5" },
      { entry: first, rank: 1, orderClass: "md:order-2" },
    ];
  }, [rankings]);

  const compareLeftEntry: PowerRankingEntry | undefined =
    rankings.find((r) => `${r.role}-${r.memberId}` === compareLeftKey) ??
    rankings[0];
  const compareRightEntry: PowerRankingEntry | undefined =
    rankings.find((r) => `${r.role}-${r.memberId}` === compareRightKey) ??
    rankings[1];

  return (
    <div className="space-y-6">
      {/* Section A: Top-3 Podium Stage */}
      {podiumTopThree.length >= 2 && (
        <div className="p5-frame bg-bt-border">
          <div className="bg-bt-surface">
            <div className="border-b border-bt-border bg-bt-elevated/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 bg-bt-red shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-bt-red" aria-hidden="true" />
                  <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                    Power Podium
                  </h2>
                </div>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                Top contenders across Active &amp; Waitlist
              </span>
            </div>

            <div
              className={`p-5 grid grid-cols-1 gap-4 items-stretch ${
                podiumTopThree.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"
              }`}
            >
              {podiumTopThree.map(({ entry, rank, orderClass }) => {
                const isFirst = rank === 1;
                return (
                  <div
                    key={`podium-${entry.role}-${entry.memberId}`}
                    className={`${orderClass} p5-frame-sm ${
                      isFirst ? "bg-bt-red" : "bg-bt-border"
                    }`}
                  >
                    <div
                      className={`p-5 h-full flex flex-col justify-between gap-4 ${
                        isFirst
                          ? "bg-gradient-to-b from-bt-red/18 via-bt-surface to-bt-surface"
                          : "bg-bt-elevated/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-display text-3xl leading-none tracking-wider ${
                              isFirst ? "text-bt-red" : "text-bt-muted"
                            }`}
                          >
                            #{String(rank).padStart(2, "0")}
                          </span>
                          {isFirst && (
                            <Crown
                              className="h-5 w-5 text-bt-red"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span
                          className={`p5-tag inline-flex items-center px-2.5 py-0.5 ${TIER_STYLES[entry.tier]}`}
                        >
                          <span className="p5-unskew font-display text-sm leading-none tracking-wider">
                            TIER {entry.tier}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <MemberAvatar
                          avatarUrl={entry.avatarUrl}
                          name={entry.name}
                          highlighted={isFirst}
                          size="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-condensed text-xl font-bold uppercase tracking-wide text-white truncate">
                              {entry.name}
                            </span>
                            {entry.role === "WAITLIST" && (
                              <span className="border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                BENCH
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.badges.map((b) => (
                              <span
                                key={b.id}
                                className={`border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${BADGE_TONE_STYLES[b.tone]}`}
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-bt-border/80 pt-3 font-mono tabular-nums">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-bt-muted">
                            Power
                          </div>
                          <div
                            className={`font-display text-2xl leading-tight ${
                              isFirst ? "text-bt-red" : "text-white"
                            }`}
                          >
                            {entry.powerScore.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-bt-muted">
                            Value
                          </div>
                          <div className="text-sm font-bold text-white mt-1">
                            {formatMoney(entry.totalRawValue, region)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-bt-muted">
                            Excl.
                          </div>
                          <div className="text-sm font-bold text-bt-red mt-1">
                            {entry.exclusiveGames.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section B: Family Hall of Fame Awards */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface">
          {/* Header */}
          <div className="border-b border-bt-border bg-bt-elevated/70 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-1 h-9 bg-bt-red shrink-0" aria-hidden="true" />
              <div className="flex items-center gap-2.5">
                <Trophy
                  className="h-5 w-5 text-bt-red shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white leading-tight">
                    Family Hall of Fame Awards
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                    Season honors &amp; standout telemetry{" "}
                    <span className="text-white">
                      [{regionConfig.code.toUpperCase()} · {regionConfig.symbol}]
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <span className="p5-tag inline-flex items-center bg-bt-red px-3 py-1 text-white">
              <span className="p5-unskew font-mono text-xs font-bold uppercase tracking-[0.14em] tabular-nums">
                {awards.length} DISTINCTIONS
              </span>
            </span>
          </div>

          {/* 2x4 / 4-Col Award Grid */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {awards.map((award) => {
              const Icon = award.icon;
              const isCrimson = award.accent === "crimson";
              const isEmpty = Boolean(award.emptyMessage);

              return (
                <div
                  key={award.id}
                  className={`p5-frame-sm p5-frame-interactive ${
                    isCrimson ? "bg-bt-red" : "bg-bt-border"
                  }`}
                >
                  <div
                    className={`p-5 h-full flex flex-col justify-between gap-4 ${
                      isCrimson
                        ? "bg-gradient-to-br from-bt-red/15 via-bt-surface to-bt-surface"
                        : "bg-bt-elevated/55"
                    }`}
                  >
                    {/* Card Top Meta */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-muted">
                          {award.index} {"//"} {award.subtitle}
                        </span>
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isCrimson ? "text-bt-red" : "text-white/80"
                          }`}
                          aria-hidden="true"
                        />
                      </div>

                      <div>
                        <span
                          className={`p5-tag inline-flex items-center px-2.5 py-0.5 ${
                            isCrimson
                              ? "bg-bt-red text-white"
                              : "bg-bt-bg border border-bt-border text-white"
                          }`}
                        >
                          <span className="p5-unskew font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                            {award.title}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Winner Identity */}
                    <div className="flex items-center gap-3.5">
                      {isEmpty && award.id === "waitlist-challenger" ? (
                        <div className="h-12 w-12 shrink-0 border border-bt-border bg-bt-bg flex items-center justify-center text-bt-dim">
                          <UserX className="h-5 w-5" aria-hidden="true" />
                        </div>
                      ) : (
                        <MemberAvatar
                          avatarUrl={award.avatarUrl}
                          name={award.winnerName}
                          highlighted={isCrimson && !isEmpty}
                          size="md"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div
                          className={`font-display text-2xl leading-none tracking-wide truncate ${
                            isEmpty ? "text-bt-muted" : "text-white"
                          }`}
                          title={award.winnerName}
                        >
                          {award.winnerName}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-bt-muted truncate">
                          {award.emptyMessage
                            ? award.emptyMessage
                            : award.winnerPersona ?? "Steam Family Contender"}
                        </div>
                      </div>
                    </div>

                    {/* Winning Stat Footer */}
                    <div
                      className={`border-t pt-2.5 flex items-baseline justify-between gap-2 font-mono tabular-nums ${
                        isCrimson ? "border-bt-red/30" : "border-bt-border/80"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          isEmpty
                            ? "text-bt-muted"
                            : isCrimson
                              ? "text-bt-red"
                              : "text-white"
                        }`}
                      >
                        {award.statValue}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-bt-muted text-right truncate">
                        {award.statLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section C: Interactive Power Rankings Table + Head-to-Head */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface">
          {/* Header */}
          <div className="border-b border-bt-border bg-bt-elevated/70 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-1 h-9 bg-bt-red shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white leading-tight">
                  Family Power Rankings
                </h2>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                  Composite score = USD-Normalized Value + (Excl. &times; 5) + (Games &times; 0.5)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
              {/* Role Filter Pills */}
              <div className="inline-flex border border-bt-border bg-bt-bg p-0.5">
                {(["ALL", "ACTIVE", "WAITLIST"] as const).map((filter) => {
                  const count =
                    filter === "ALL"
                      ? rankings.length
                      : filter === "ACTIVE"
                        ? analysis.members.length
                        : waitlistLibraries.length;
                  const active = roleFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRoleFilter(filter)}
                      className={`cursor-pointer px-2.5 py-1 transition-colors tabular-nums ${
                        active
                          ? "bg-bt-red text-white font-bold"
                          : "text-bt-muted hover:text-white"
                      }`}
                    >
                      {filter} ({count})
                    </button>
                  );
                })}
              </div>

              {rankings.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setCompareOpen((prev) => !prev)}
                  className={`cursor-pointer inline-flex items-center gap-1.5 border px-3 py-1.5 transition-colors ${
                    compareOpen
                      ? "border-bt-red bg-bt-red/15 text-white font-bold"
                      : "border-bt-border bg-bt-bg text-bt-muted hover:border-bt-red hover:text-white"
                  }`}
                >
                  <Swords className="h-3.5 w-3.5 text-bt-red" />
                  <span>Head-to-Head</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Head-to-Head Comparison Strip */}
          {compareOpen && compareLeftEntry && compareRightEntry && (
            <div className="border-b border-bt-border bg-bt-bg/80 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-bt-red font-bold">
                  <Swords className="h-4 w-4" />
                  <span>Head-to-Head Telemetry</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <select
                    aria-label="First contender"
                    value={`${compareLeftEntry.role}-${compareLeftEntry.memberId}`}
                    onChange={(e) => setCompareLeftKey(e.target.value)}
                    className="border border-bt-border bg-bt-surface px-2.5 py-1.5 text-white focus:border-bt-red focus:outline-none"
                  >
                    {rankings.map((r) => (
                      <option
                        key={`l-${r.role}-${r.memberId}`}
                        value={`${r.role}-${r.memberId}`}
                      >
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                  <span className="text-bt-muted font-bold">VS</span>
                  <select
                    aria-label="Second contender"
                    value={`${compareRightEntry.role}-${compareRightEntry.memberId}`}
                    onChange={(e) => setCompareRightKey(e.target.value)}
                    className="border border-bt-border bg-bt-surface px-2.5 py-1.5 text-white focus:border-bt-red focus:outline-none"
                  >
                    {rankings.map((r) => (
                      <option
                        key={`r-${r.role}-${r.memberId}`}
                        value={`${r.role}-${r.memberId}`}
                      >
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  {
                    label: "Power Score",
                    a: compareLeftEntry.powerScore,
                    b: compareRightEntry.powerScore,
                    fmt: (v: number) => v.toLocaleString(),
                  },
                  {
                    label: "Raw Value",
                    a: compareLeftEntry.totalRawValue,
                    b: compareRightEntry.totalRawValue,
                    fmt: (v: number) => formatMoney(v, region),
                  },
                  {
                    label: "Games",
                    a: compareLeftEntry.totalGames,
                    b: compareRightEntry.totalGames,
                    fmt: (v: number) => v.toLocaleString(),
                  },
                  {
                    label: "Exclusives",
                    a: compareLeftEntry.exclusiveGames,
                    b: compareRightEntry.exclusiveGames,
                    fmt: (v: number) => v.toLocaleString(),
                  },
                  {
                    label: "Avg / Game",
                    a: compareLeftEntry.avgGameValue,
                    b: compareRightEntry.avgGameValue,
                    fmt: (v: number) => formatMoney(v, region),
                  },
                  {
                    label: "Excl. Rate",
                    a: compareLeftEntry.exclusivityPct,
                    b: compareRightEntry.exclusivityPct,
                    fmt: (v: number) => `${v.toFixed(1)}%`,
                  },
                ].map((stat) => {
                  const aWins = stat.a > stat.b;
                  const bWins = stat.b > stat.a;
                  return (
                    <div
                      key={stat.label}
                      className="border border-bt-border bg-bt-surface p-3 space-y-1.5 font-mono tabular-nums"
                    >
                      <div className="text-[10px] uppercase tracking-[0.14em] text-bt-muted">
                        {stat.label}
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span
                          className={`truncate ${
                            aWins ? "text-bt-red font-bold" : "text-bt-muted"
                          }`}
                        >
                          {stat.fmt(stat.a)}
                        </span>
                        <span className="text-bt-dim">/</span>
                        <span
                          className={`truncate ${
                            bWins ? "text-emerald-400 font-bold" : "text-bt-muted"
                          }`}
                        >
                          {stat.fmt(stat.b)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table */}
          {displayedRankings.length === 0 ? (
            <div className="p-6 font-mono text-sm text-bt-muted">
              No members match this filter yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-bt-bg border-b border-bt-border font-mono text-[11px] uppercase tracking-[0.12em] text-bt-muted">
                  <tr>
                    <th className="px-3.5 py-3.5 font-medium w-16">Rank</th>
                    <th className="px-2.5 py-3.5 font-medium w-20 text-center">
                      Tier
                    </th>
                    <th className="px-3.5 py-3.5 font-medium">Member</th>
                    <th className="px-2.5 py-3.5 font-medium">Role</th>
                    <th className="px-2.5 py-3.5 text-right font-medium">
                      <SortHeaderButton
                        label="Games"
                        sortKey="totalGames"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium">
                      <SortHeaderButton
                        label="Excl."
                        sortKey="exclusiveGames"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      <SortHeaderButton
                        label="Excl. %"
                        sortKey="exclusivityPct"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      <SortHeaderButton
                        label="Avg/Game"
                        sortKey="avgGameValue"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      <SortHeaderButton
                        label="Raw Value"
                        sortKey="totalRawValue"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      <SortHeaderButton
                        label="Share %"
                        sortKey="sharePercent"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-3.5 py-3.5 text-right font-medium whitespace-nowrap">
                      <SortHeaderButton
                        label="Power Score"
                        sortKey="powerScore"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bt-border/80">
                  {displayedRankings.map((entry) => {
                    const overallRank =
                      overallRankByKey.get(`${entry.role}-${entry.memberId}`) ?? 1;
                    const isRankOne = overallRank === 1;
                    const rankDisplay = `#${String(overallRank).padStart(2, "0")}`;
                    const isWaitlist = entry.role === "WAITLIST";
                    const scorePct =
                      maxPowerScore > 0
                        ? Math.max(4, Math.round((entry.powerScore / maxPowerScore) * 100))
                        : 0;

                    return (
                      <tr
                        key={`${entry.role}-${entry.memberId}`}
                        className={`hover:bg-bt-elevated/90 transition-colors ${
                          isRankOne ? "bg-bt-red/[0.05]" : ""
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-3.5 py-3.5">
                          <span
                            className={`font-display text-2xl leading-none tracking-wider tabular-nums ${
                              isRankOne ? "text-bt-red" : "text-bt-muted"
                            }`}
                          >
                            {rankDisplay}
                          </span>
                        </td>

                        {/* Tier Grade */}
                        <td className="px-2.5 py-3.5 text-center">
                          <span
                            className={`p5-tag inline-flex items-center justify-center min-w-[30px] px-2 py-0.5 ${TIER_STYLES[entry.tier]}`}
                          >
                            <span className="p5-unskew font-display text-base leading-none tracking-wider">
                              {entry.tier}
                            </span>
                          </span>
                        </td>

                        {/* Member + Badges */}
                        <td className="px-3.5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar
                              avatarUrl={entry.avatarUrl}
                              name={entry.name}
                              highlighted={isRankOne}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-condensed text-base font-bold uppercase tracking-wide text-white truncate">
                                {entry.name}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {entry.badges.length > 0 ? (
                                  entry.badges.map((b) => (
                                    <span
                                      key={b.id}
                                      className={`border px-1.5 py-0 font-mono text-[9px] font-bold uppercase tracking-wider ${BADGE_TONE_STYLES[b.tone]}`}
                                    >
                                      {b.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="font-mono text-[11px] text-bt-muted truncate max-w-[160px]">
                                    {entry.personaName !== entry.name
                                      ? entry.personaName
                                      : entry.steamId64}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-2.5 py-3.5 whitespace-nowrap">
                          {isWaitlist ? (
                            <span className="inline-flex items-center border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                              WAITLIST
                            </span>
                          ) : (
                            <span className="inline-flex items-center border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                              ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Games */}
                        <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums text-white/90">
                          {entry.totalGames.toLocaleString()}
                        </td>

                        {/* Exclusive Games */}
                        <td
                          className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums font-medium text-bt-red"
                          title={
                            isWaitlist
                              ? "Net-new games not currently owned by active family"
                              : "Games owned exclusively by this member"
                          }
                        >
                          {entry.exclusiveGames.toLocaleString()}
                        </td>

                        {/* Exclusivity % */}
                        <td className="px-2.5 py-3.5 text-right font-mono text-xs tabular-nums text-bt-muted">
                          {entry.exclusivityPct.toFixed(1)}%
                        </td>

                        {/* Avg / Game */}
                        <td className="px-2.5 py-3.5 text-right font-mono text-xs tabular-nums text-white/85 whitespace-nowrap">
                          {formatMoney(entry.avgGameValue, region)}
                        </td>

                        {/* Raw Value */}
                        <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums font-semibold text-white whitespace-nowrap">
                          {formatMoney(entry.totalRawValue, region)}
                        </td>

                        {/* Share % */}
                        <td className="px-2.5 py-3.5 text-right font-mono text-xs tabular-nums">
                          {entry.sharePercent !== null ? (
                            <span
                              className={
                                isRankOne
                                  ? "font-bold text-bt-red"
                                  : "font-semibold text-white"
                              }
                            >
                              {entry.sharePercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span
                              className="text-bt-dim"
                              title="Waitlist members are not part of active family share"
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Power Score + Visual Bar + Breakdown */}
                        <td
                          className="px-3.5 py-3.5 text-right whitespace-nowrap"
                          title={`Value: ${entry.powerBreakdown.valuePoints} · Exclusives: ${entry.powerBreakdown.exclusivePoints} · Size: ${entry.powerBreakdown.volumePoints}`}
                        >
                          <div className="inline-flex flex-col items-end gap-1 min-w-[92px]">
                            <span
                              className={`font-display text-2xl leading-none tracking-wide tabular-nums ${
                                isRankOne ? "text-bt-red" : "text-white"
                              }`}
                            >
                              {entry.powerScore.toLocaleString()}
                            </span>
                            <div className="w-full h-1 bg-bt-bg overflow-hidden">
                              <div
                                className={`h-full ${
                                  isRankOne ? "bg-bt-red" : "bg-white/60"
                                }`}
                                style={{ width: `${scorePct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[9px] text-bt-muted tabular-nums">
                              {entry.powerBreakdown.valuePoints}v +{" "}
                              {entry.powerBreakdown.exclusivePoints}e +{" "}
                              {entry.powerBreakdown.volumePoints}g
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
