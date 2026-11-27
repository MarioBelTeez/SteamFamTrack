"use client";

import { useMemo, useState } from "react";
import {
  buildFamilyAchievements,
  buildPowerRankings,
  sortPowerRankings,
  summarizeWaitlistLibrary,
  type AchievementCategory,
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
  Clock,
  Crosshair,
  Crown,
  Flame,
  Gamepad2,
  Gem,
  HeartHandshake,
  Library,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

interface FamilyLeaderboardProps {
  analysis: FamilyAnalysis;
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
  includeExcluded?: boolean;
}

const ACHIEVEMENT_ICONS: Record<string, typeof Crown> = {
  "high-roller": Sparkles,
  purist: Gem,
  "crown-jewel": Crown,
  "team-player": Users,
  "no-lifer": Clock,
  "one-trick": Gamepad2,
  "biggest-whale": Trophy,
  "library-king": Library,
  "exclusive-dealer": Flame,
  "target-locked": Crosshair,
  "waitlist-challenger": Swords,
  "most-generous": HeartHandshake,
};

type RoleFilter = "ALL" | "ACTIVE" | "WAITLIST";
type AchievementFilter = "ALL" | AchievementCategory;

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
  const [achievementFilter, setAchievementFilter] =
    useState<AchievementFilter>("ALL");
  const [selectedTrophyMemberId, setSelectedTrophyMemberId] = useState<
    string | null
  >(null);
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

  const { achievements, trophyCounts } = useMemo(
    () =>
      buildFamilyAchievements(
        analysis,
        activeLibraries,
        waitlistSummaries,
        rankings,
        (val) => formatMoney(val, region),
        includeExcluded
      ),
    [
      analysis,
      activeLibraries,
      waitlistSummaries,
      rankings,
      region,
      includeExcluded,
    ]
  );

  const displayedAchievements = useMemo(() => {
    return achievements.filter((ach) => {
      if (
        achievementFilter !== "ALL" &&
        ach.category !== achievementFilter
      ) {
        return false;
      }
      if (
        selectedTrophyMemberId &&
        ach.winner?.memberId !== selectedTrophyMemberId
      ) {
        return false;
      }
      return true;
    });
  }, [achievements, achievementFilter, selectedTrophyMemberId]);

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

      {/* Section B: Trophy Cabinet & Achievement Showcase */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface">
          {/* Header + Category Filter */}
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
                    Family Trophy Cabinet
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                    Efficiency, playtime, squad &amp; volume honors{" "}
                    <span className="text-white">
                      [{regionConfig.code.toUpperCase()} · {regionConfig.symbol}]
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="inline-flex flex-wrap border border-bt-border bg-bt-bg p-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
              {(
                [
                  ["ALL", "All"],
                  ["efficiency", "Skill / Rate"],
                  ["playtime", "Playtime"],
                  ["squad", "Squad"],
                  ["volume", "Volume"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAchievementFilter(key)}
                  className={`cursor-pointer px-2.5 py-1 transition-colors ${
                    achievementFilter === key
                      ? "bg-bt-red text-white font-bold"
                      : "text-bt-muted hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Trophy Rack (click a member to filter their trophies) */}
          {trophyCounts.length > 0 && (
            <div className="border-b border-bt-border bg-bt-bg/60 px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bt-muted">
                <span>TROPHY STANDINGS // CLICK A MEMBER TO FILTER</span>
                {selectedTrophyMemberId && (
                  <button
                    type="button"
                    onClick={() => setSelectedTrophyMemberId(null)}
                    className="cursor-pointer text-bt-red hover:underline font-bold"
                  >
                    CLEAR FILTER
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {trophyCounts.map((member) => {
                  const isSelected = selectedTrophyMemberId === member.memberId;
                  return (
                    <button
                      key={`rack-${member.role}-${member.memberId}`}
                      type="button"
                      onClick={() =>
                        setSelectedTrophyMemberId((prev) =>
                          prev === member.memberId ? null : member.memberId
                        )
                      }
                      className={`cursor-pointer text-left border px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? "border-bt-red bg-bt-red/15"
                          : "border-bt-border bg-bt-surface hover:border-bt-red/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MemberAvatar
                          avatarUrl={member.avatarUrl}
                          name={member.name}
                          highlighted={member.trophies.length > 0}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-condensed text-sm font-bold uppercase tracking-wide text-white truncate">
                            {member.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {member.trophies.length > 0 ? (
                              member.trophies.map((t) => (
                                <span
                                  key={t.id}
                                  className={`border px-1.5 py-0 font-mono text-[9px] font-bold uppercase tracking-wider ${BADGE_TONE_STYLES[t.accent]}`}
                                >
                                  {t.title}
                                </span>
                              ))
                            ) : (
                              <span className="font-mono text-[10px] text-bt-dim">
                                Hunting first trophy
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <span
                          className={`font-display text-2xl leading-none ${
                            member.trophies.length > 0
                              ? "text-bt-red"
                              : "text-bt-dim"
                          }`}
                        >
                          {member.trophies.length}
                        </span>
                        <div className="text-[9px] uppercase tracking-wider text-bt-muted">
                          {member.trophies.length === 1 ? "TROPHY" : "TROPHIES"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact Trophy Shelf (Winner + Runner-Up) */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {displayedAchievements.length === 0 ? (
              <div className="col-span-full font-mono text-xs text-bt-muted py-4">
                No trophies match the selected filter.
              </div>
            ) : (
              displayedAchievements.map((ach) => {
                const Icon = ACHIEVEMENT_ICONS[ach.id] ?? Trophy;
                const tone = ach.accent ?? "crimson";
                const isHighlight = tone === "crimson";

                return (
                  <div
                    key={ach.id}
                    className={`border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isHighlight
                        ? "border-bt-red/50 bg-gradient-to-br from-bt-red/10 via-bt-surface to-bt-surface"
                        : "border-bt-border bg-bt-elevated/45"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${BADGE_TONE_STYLES[tone]}`}
                        >
                          {ach.title}
                        </span>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bt-muted">
                          {ach.subtitle}
                        </div>
                      </div>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isHighlight ? "text-bt-red" : "text-white/75"
                        }`}
                        aria-hidden="true"
                      />
                    </div>

                    {ach.winner ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MemberAvatar
                            avatarUrl={ach.winner.avatarUrl}
                            name={ach.winner.name}
                            highlighted={isHighlight}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-condensed text-base font-bold uppercase tracking-wide text-white truncate">
                              {ach.winner.name}
                            </div>
                            {ach.winner.subText && (
                              <div className="font-mono text-[10px] text-bt-muted truncate max-w-[180px]">
                                {ach.winner.subText}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right font-mono tabular-nums">
                          <div
                            className={`text-sm font-bold ${
                              isHighlight ? "text-bt-red" : "text-white"
                            }`}
                          >
                            {ach.winner.statText}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-bt-dim">
                        No qualifying member yet
                      </div>
                    )}

                    {ach.runnerUp && (
                      <div className="border-t border-bt-border/60 pt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-bt-muted">
                        <span className="truncate">
                          2nd: <span className="text-white/80">{ach.runnerUp.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white/75 truncate max-w-[160px]">
                          {ach.runnerUp.statText}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
