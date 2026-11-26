"use client";

import { useMemo } from "react";
import {
  buildPowerRankings,
  summarizeWaitlistLibrary,
  type TierGrade,
} from "@/lib/leaderboard";
import {
  FamilyAnalysis,
  MemberLibrary,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  Crosshair,
  Crown,
  Gem,
  HeartHandshake,
  Library,
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
  size?: "sm" | "md";
}

function MemberAvatar({
  avatarUrl,
  name,
  highlighted = false,
  size = "sm",
}: MemberAvatarProps) {
  const dimensions = size === "md" ? "h-12 w-12" : "h-8 w-8";
  const borderColor = highlighted ? "border-bt-red" : "border-bt-border";
  const textClass =
    size === "md"
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

/**
 * Persona 5-styled Family Power Rankings & Hall of Fame Awards Leaderboard.
 */
export function FamilyLeaderboard({
  analysis,
  activeLibraries,
  waitlistLibraries,
  region,
  includeExcluded = false,
}: FamilyLeaderboardProps) {
  const regionConfig = STEAM_REGIONS[region];

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
        id: "most-generous",
        index: "AWARD 04",
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
        index: "AWARD 05",
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
        index: "AWARD 06",
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
    waitlistSummaries,
    memberIdentityById,
    region,
  ]);

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

  return (
    <div className="space-y-6">
      {/* Section A: Family Hall of Fame Awards */}
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
                6 DISTINCTIONS
              </span>
            </span>
          </div>

          {/* 2x3 / 3-Col Award Grid */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                          className={`font-display text-2xl xl:text-[28px] leading-none tracking-wide truncate ${
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

      {/* Section B: Power Rankings Table (Active + Waitlist) */}
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

            <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span className="border border-bt-border bg-bt-bg px-2.5 py-1 text-bt-muted tabular-nums">
                ACTIVE:{" "}
                <span className="text-white font-bold">
                  {analysis.members.length}
                </span>
              </span>
              <span className="border border-bt-border bg-bt-bg px-2.5 py-1 text-bt-muted tabular-nums">
                WAITLIST:{" "}
                <span className="text-amber-300 font-bold">
                  {waitlistLibraries.length}
                </span>
              </span>
              <span className="p5-tag inline-flex items-center bg-bt-red px-3 py-1 text-white">
                <span className="p5-unskew font-mono text-xs font-bold uppercase tracking-[0.14em] tabular-nums">
                  {rankings.length} RANKED
                </span>
              </span>
            </div>
          </div>

          {/* Table */}
          {rankings.length === 0 ? (
            <div className="p-6 font-mono text-sm text-bt-muted">
              No active or waitlisted members to rank yet.
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
                      Games
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium">
                      Excl.
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      Raw Value
                    </th>
                    <th className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap">
                      Share %
                    </th>
                    <th className="px-3.5 py-3.5 text-right font-medium whitespace-nowrap">
                      Power Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bt-border/80">
                  {rankings.map((entry, idx) => {
                    const isRankOne = idx === 0;
                    const rankDisplay = `#${String(idx + 1).padStart(2, "0")}`;
                    const isWaitlist = entry.role === "WAITLIST";

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

                        {/* Member */}
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
                              <div className="font-mono text-[11px] text-bt-muted truncate max-w-[160px]">
                                {entry.personaName !== entry.name
                                  ? entry.personaName
                                  : entry.steamId64}
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

                        {/* Power Score */}
                        <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                          <span
                            className={`font-display text-2xl leading-none tracking-wide tabular-nums ${
                              isRankOne ? "text-bt-red" : "text-white"
                            }`}
                          >
                            {entry.powerScore.toLocaleString()}
                          </span>
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
