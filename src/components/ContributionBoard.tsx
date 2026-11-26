"use client";

import { useMemo, useState } from "react";
import { FamilyAnalysis, MemberContribution } from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  CheckCircle2,
  Clock,
  Crosshair,
  Layers,
  Library,
  Scale,
  ShieldAlert,
  Skull,
} from "lucide-react";

interface ContributionBoardProps {
  analysis: FamilyAnalysis;
}

type SortKey =
  | "totalGames"
  | "exclusiveGames"
  | "sharedGames"
  | "totalRawValue"
  | "exclusiveValue"
  | "sharePercent";

type SortDirection = "desc" | "asc";

export function ContributionBoard({ analysis }: ContributionBoardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalRawValue");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const sym = analysis.currencySymbol;
  const top = analysis.members[0];

  const formatMoney = (val: number) => {
    if (analysis.region === "jp") {
      return `${sym}${Math.round(val).toLocaleString()}`;
    }
    return `${sym}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatSignedMoney = (val: number) => {
    if (Math.abs(val) < 0.005) {
      return formatMoney(0);
    }
    const sign = val > 0 ? "+" : "-";
    return `${sign}${formatMoney(Math.abs(val))}`;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedMembers = useMemo(() => {
    const list = [...analysis.members];
    list.sort((a: MemberContribution, b: MemberContribution) => {
      const diff = a[sortKey] - b[sortKey];
      if (diff !== 0) return sortDir === "desc" ? -diff : diff;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [analysis.members, sortKey, sortDir]);

  const getAriaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  const upNextMember = useMemo(
    () =>
      analysis.fairness.members.find(
        (m) => m.isUpNext || m.memberId === analysis.fairness.upNextMemberId
      ) ?? null,
    [analysis.fairness]
  );

  const upNextAvatarUrl = useMemo(() => {
    if (!upNextMember) return "";
    return (
      analysis.members.find((m) => m.memberId === upNextMember.memberId)
        ?.avatarUrl ?? ""
    );
  }, [analysis.members, upNextMember]);

  const maxAbsDelta = useMemo(() => {
    if (analysis.fairness.members.length === 0) return 1;
    return Math.max(
      1,
      ...analysis.fairness.members.map((m) => Math.abs(m.deltaFromAverageValue))
    );
  }, [analysis.fairness.members]);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 text-bt-dim" aria-hidden="true" />;
    }
    return sortDir === "desc" ? (
      <ArrowDown className="h-3 w-3 text-bt-red" aria-hidden="true" />
    ) : (
      <ArrowUp className="h-3 w-3 text-bt-red" aria-hidden="true" />
    );
  };

  const topMemberId = top?.memberId ?? null;

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 01 // UNIQUE CATALOG */}
        <div className="p5-frame p5-frame-interactive bg-bt-border">
          <div className="bg-bt-surface p-5 h-full flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bt-muted">
                01 // UNIQUE CATALOG
              </span>
              <Library className="h-4 w-4 text-bt-red shrink-0" aria-hidden="true" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl xl:text-[42px] leading-none tracking-wide text-white tabular-nums">
                {analysis.uniqueGamesCount.toLocaleString()}
              </span>
              <span className="font-display text-2xl leading-none tracking-wider text-bt-muted">
                GAMES
              </span>
            </div>

            <div className="border-t border-bt-border/80 pt-2.5 flex items-baseline justify-between gap-2 font-mono text-sm tabular-nums">
              <span className="font-medium text-bt-red">
                {formatMoney(analysis.uniqueCatalogValue)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                RAW VALUE
              </span>
            </div>
          </div>
        </div>

        {/* 02 // TOTAL COPIES */}
        <div className="p5-frame p5-frame-interactive bg-bt-border">
          <div className="bg-bt-surface p-5 h-full flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bt-muted">
                02 // TOTAL COPIES
              </span>
              <Layers className="h-4 w-4 text-white/80 shrink-0" aria-hidden="true" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl xl:text-[42px] leading-none tracking-wide text-white tabular-nums">
                {analysis.sumCopiesCount.toLocaleString()}
              </span>
              <span className="font-display text-2xl leading-none tracking-wider text-bt-muted">
                COPIES
              </span>
            </div>

            <div className="border-t border-bt-border/80 pt-2.5 flex items-baseline justify-between gap-2 font-mono text-sm tabular-nums">
              <span className="font-medium text-white">
                {formatMoney(analysis.sumCopiesValue)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                GROSS TOTAL
              </span>
            </div>
          </div>
        </div>

        {/* 03 // TOP CONTRIBUTOR (Highlighted Crimson Frame) */}
        <div className="p5-frame p5-frame-interactive bg-bt-red">
          <div className="bg-bt-surface p-5 h-full flex flex-col justify-between gap-4 bg-gradient-to-br from-bt-red/15 via-bt-surface to-bt-surface">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/90">
                03 // TOP CONTRIBUTOR
              </span>
              <Award className="h-4 w-4 text-bt-red shrink-0" aria-hidden="true" />
            </div>

            <div
              className="font-display text-4xl xl:text-[42px] leading-none tracking-wide text-white truncate"
              title={top ? top.name : undefined}
            >
              {top ? top.name : "—"}
            </div>

            <div className="border-t border-bt-red/30 pt-2.5 flex items-baseline justify-between gap-2 font-mono text-sm tabular-nums">
              <span className="font-semibold text-bt-red">
                {top ? `${top.sharePercent.toFixed(1)}% SHARE` : "—"}
              </span>
              <span className="font-medium text-white">
                {top ? formatMoney(top.totalRawValue) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* 04 // SHARING EXCLUDED */}
        <div className="p5-frame p5-frame-interactive bg-bt-border">
          <div className="bg-bt-surface p-5 h-full flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bt-muted">
                04 // SHARING EXCLUDED
              </span>
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl xl:text-[42px] leading-none tracking-wide text-white tabular-nums">
                {analysis.excludedGamesCount.toLocaleString()}
              </span>
              <span className="font-display text-2xl leading-none tracking-wider text-bt-muted">
                EXCLUDED
              </span>
            </div>

            <div className="border-t border-bt-border/80 pt-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bt-muted">
              Publisher opted out of Family Sharing
            </div>
          </div>
        </div>
      </div>

      {/* 2. Member Contribution Leaderboard */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface">
          {/* Header Bar */}
          <div className="border-b border-bt-border bg-bt-elevated/70 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-1 h-9 bg-bt-red shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white leading-tight">
                  Member Contribution Breakdown
                </h2>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                  Raw non-discounted regional store value{" "}
                  <span className="text-white">
                    [{analysis.region.toUpperCase()} · {sym}]
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="p5-tag inline-flex items-center bg-bt-red px-3 py-1 text-white">
                <span className="p5-unskew font-mono text-xs font-bold uppercase tracking-[0.14em] tabular-nums">
                  {analysis.members.length} / 6 SLOTS
                </span>
              </span>
            </div>
          </div>

          {/* Editorial Telemetry Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-bt-bg border-b border-bt-border font-mono text-[11px] uppercase tracking-[0.12em] text-bt-muted">
                <tr>
                  <th className="px-3.5 py-3.5 font-medium w-12">#</th>
                  <th className="px-3.5 py-3.5 font-medium">Member</th>
                  <th
                    className="px-2.5 py-3.5 text-right font-medium"
                    aria-sort={getAriaSort("totalGames")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("totalGames")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Total</span>
                      {renderSortIcon("totalGames")}
                    </button>
                  </th>
                  <th
                    className="px-2.5 py-3.5 text-right font-medium"
                    aria-sort={getAriaSort("exclusiveGames")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("exclusiveGames")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Excl.</span>
                      {renderSortIcon("exclusiveGames")}
                    </button>
                  </th>
                  <th
                    className="px-2.5 py-3.5 text-right font-medium"
                    aria-sort={getAriaSort("sharedGames")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("sharedGames")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Shared</span>
                      {renderSortIcon("sharedGames")}
                    </button>
                  </th>
                  <th
                    className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap"
                    aria-sort={getAriaSort("totalRawValue")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("totalRawValue")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Raw Value</span>
                      {renderSortIcon("totalRawValue")}
                    </button>
                  </th>
                  <th
                    className="px-2.5 py-3.5 text-right font-medium whitespace-nowrap"
                    aria-sort={getAriaSort("exclusiveValue")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("exclusiveValue")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Excl. Val</span>
                      {renderSortIcon("exclusiveValue")}
                    </button>
                  </th>
                  <th
                    className="px-3.5 py-3.5 min-w-[140px] font-medium whitespace-nowrap"
                    aria-sort={getAriaSort("sharePercent")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("sharePercent")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.12em] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Share</span>
                      {renderSortIcon("sharePercent")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-medium whitespace-nowrap">
                    Slot Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bt-border/80">
                {sortedMembers.map((m, idx) => {
                  const isRankOne = idx === 0;
                  const isTopContributor = m.memberId === topMemberId;
                  const rankDisplay = String(idx + 1).padStart(2, "0");

                  return (
                    <tr
                      key={m.memberId}
                      className={`hover:bg-bt-elevated/90 transition-colors ${
                        isTopContributor ? "bg-bt-red/[0.04]" : ""
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

                      {/* Member */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              className={`h-8 w-8 shrink-0 object-cover border ${
                                isTopContributor
                                  ? "border-bt-red"
                                  : "border-bt-border"
                              }`}
                            />
                          ) : (
                            <div
                              className={`h-8 w-8 shrink-0 border bg-bt-elevated flex items-center justify-center font-display text-sm tracking-wider ${
                                isTopContributor
                                  ? "border-bt-red text-bt-red"
                                  : "border-bt-border text-white"
                              }`}
                            >
                              {m.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-condensed text-base font-bold uppercase tracking-wide text-white truncate">
                                {m.name}
                              </span>
                              {isTopContributor && (
                                <span className="p5-tag inline-flex items-center bg-bt-red px-1.5 py-0.5 text-white shrink-0">
                                  <span className="p5-unskew font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
                                    LEAD
                                  </span>
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-bt-muted truncate max-w-[140px]">
                              {m.personaName !== m.name
                                ? m.personaName
                                : m.steamId64}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums text-white/90">
                        {m.totalGames.toLocaleString()}
                      </td>

                      {/* Exclusive */}
                      <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums font-medium text-bt-red">
                        {m.exclusiveGames.toLocaleString()}
                      </td>

                      {/* Shared */}
                      <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums text-bt-muted">
                        {m.sharedGames.toLocaleString()}
                      </td>

                      {/* Raw Value */}
                      <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums font-semibold text-white whitespace-nowrap">
                        {formatMoney(m.totalRawValue)}
                      </td>

                      {/* Excl. Value */}
                      <td className="px-2.5 py-3.5 text-right font-mono text-sm tabular-nums text-bt-muted whitespace-nowrap">
                        {formatMoney(m.exclusiveValue)}
                      </td>

                      {/* Contribution Share */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 bg-bt-bg border border-bt-border/80 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isTopContributor
                                  ? "bg-bt-red"
                                  : idx === 1
                                    ? "bg-white/90"
                                    : "bg-white/65"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(0, m.sharePercent))}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`w-11 text-right font-mono text-xs font-bold tabular-nums ${
                              isTopContributor ? "text-bt-red" : "text-white"
                            }`}
                          >
                            {m.sharePercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* 1-Yr Slot Status */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        {m.cooldown.isSlotUnlocked ? (
                          <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Unlocked</span>
                          </span>
                        ) : (
                          <span
                            title={`Joined ${m.cooldown.joinDate} · Unlocks ${m.cooldown.slotUnlockDate}`}
                            className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-amber-300 tabular-nums"
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {m.cooldown.daysUntilUnlock}d ·{" "}
                              {m.cooldown.slotUnlockDate}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Fairness Meter ("Who's Up Next to Contribute") */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface">
          {/* Header */}
          <div className="border-b border-bt-border bg-bt-elevated/70 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-1 h-9 bg-bt-red shrink-0" aria-hidden="true" />
              <div className="flex items-center gap-2.5">
                <Scale className="h-5 w-5 text-bt-red shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white leading-tight">
                    Fairness Meter
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bt-muted">
                    Deviation from group average · equal-share balance telemetry
                  </p>
                </div>
              </div>
            </div>

            {/* Axis Legend */}
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-bt-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 bg-bt-red inline-block" aria-hidden="true" />
                Below Avg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 bg-emerald-400 inline-block" aria-hidden="true" />
                Above Avg
              </span>
            </div>
          </div>

          {analysis.fairness.members.length === 0 ? (
            <div className="p-5 font-mono text-sm text-bt-muted">
              No active members to compare.
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-5">
              {/* Left Spotlight Callout */}
              <div className="bg-bt-red/10 border border-bt-red/30 border-l-4 border-l-bt-red p-5 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="p5-tag inline-flex items-center bg-bt-red px-2.5 py-1 text-white">
                    <span className="p5-unskew inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                      <Crosshair className="h-3 w-3" aria-hidden="true" />
                      UP NEXT TO BUY / ADD
                    </span>
                  </div>

                  <div>
                    <div
                      className="font-display text-3xl xl:text-4xl leading-none tracking-wide text-white truncate"
                      title={analysis.fairness.upNextMemberName ?? undefined}
                    >
                      {analysis.fairness.upNextMemberName ?? "BALANCED"}
                    </div>

                    {upNextMember ? (
                      <div className="mt-2 space-y-1 font-mono tabular-nums">
                        <div className="text-sm font-bold text-bt-red">
                          {formatSignedMoney(upNextMember.deltaFromAverageValue)}{" "}
                          <span className="text-[11px] font-normal uppercase tracking-wider text-bt-muted">
                            vs. avg
                          </span>
                        </div>
                        <div className="text-xs text-bt-muted">
                          Current share:{" "}
                          <span className="text-white font-medium">
                            {upNextMember.sharePercent.toFixed(1)}%
                          </span>{" "}
                          of{" "}
                          <span className="text-white font-medium">
                            {analysis.fairness.expectedSharePercent.toFixed(1)}%
                          </span>{" "}
                          target
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-xs text-bt-muted">
                        All members are currently at equal contribution.
                      </p>
                    )}
                  </div>
                </div>

                {/* Target Lock PFP Showcase */}
                {upNextMember && (
                  <div className="my-1 flex flex-col items-center justify-center py-2">
                    <div className="relative h-28 w-28 flex items-center justify-center">
                      {/* Outer Tactical Corner Brackets */}
                      <span
                        className="pointer-events-none absolute inset-0 border border-bt-red/40"
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-bt-red"
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-bt-red"
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-bt-red"
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-bt-red"
                        aria-hidden="true"
                      />

                      {upNextAvatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={upNextAvatarUrl}
                          alt={upNextMember.name}
                          className="h-24 w-24 object-cover grayscale-[20%] contrast-110"
                        />
                      ) : (
                        <div className="h-24 w-24 bg-bt-elevated flex items-center justify-center font-display text-3xl text-white">
                          {upNextMember.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Crosshair Overlay SVG */}
                      <svg
                        viewBox="0 0 112 112"
                        className="pointer-events-none absolute inset-0 h-full w-full text-bt-red drop-shadow-[0_0_6px_rgb(var(--bt-accent-rgb)/0.75)]"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="56"
                          cy="56"
                          r="38"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeDasharray="6 4"
                          opacity="0.85"
                        />
                        <circle
                          cx="56"
                          cy="56"
                          r="12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          opacity="0.9"
                        />
                        <line x1="56" y1="4" x2="56" y2="24" stroke="currentColor" strokeWidth="1.75" />
                        <line x1="56" y1="88" x2="56" y2="108" stroke="currentColor" strokeWidth="1.75" />
                        <line x1="4" y1="56" x2="24" y2="56" stroke="currentColor" strokeWidth="1.75" />
                        <line x1="88" y1="56" x2="108" y2="56" stroke="currentColor" strokeWidth="1.75" />
                      </svg>
                    </div>
                    <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-bt-red">
                      TARGET LOCKED // CONTRIBUTION DUE
                    </span>
                  </div>
                )}

                <div className="border-t border-bt-red/25 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bt-muted">
                      Group Avg
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white tabular-nums">
                      {formatMoney(analysis.fairness.averageRawValue)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bt-muted">
                      Equal Target
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white tabular-nums">
                      {analysis.fairness.expectedSharePercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Diverging Balance Bars */}
              <div className="flex flex-col justify-between gap-3">
                {/* Axis Scale Header */}
                <div className="grid grid-cols-3 items-center px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bt-muted tabular-nums">
                  <span className="text-left text-bt-red">
                    &larr; Deficit ({formatSignedMoney(-maxAbsDelta)})
                  </span>
                  <span className="text-center text-white">
                    AVG · {formatMoney(0)}
                  </span>
                  <span className="text-right text-emerald-400">
                    Surplus ({formatSignedMoney(maxAbsDelta)}) &rarr;
                  </span>
                </div>

                {/* Member Rows */}
                <div className="space-y-2.5">
                  {analysis.fairness.members.map((fm) => {
                    const isNeutral = Math.abs(fm.deltaFromAverageValue) < 0.005;
                    const isAhead = fm.deltaFromAverageValue > 0;
                    const isFreeloaderSkull =
                      fm.sharePercent < 15 && !isAhead && !isNeutral;
                    const ratioPct = Math.min(
                      100,
                      (Math.abs(fm.deltaFromAverageValue) / maxAbsDelta) * 100
                    );
                    const visualWidth = isNeutral ? 0 : Math.max(3, ratioPct);

                    return (
                      <div
                        key={fm.memberId}
                        className={`border px-4 py-3 transition-colors ${
                          fm.isUpNext
                            ? "border-bt-red/50 bg-bt-red/[0.07]"
                            : "border-bt-border/80 bg-bt-elevated/40 hover:bg-bt-elevated/75"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-condensed text-base font-bold uppercase tracking-wide text-white truncate">
                              {fm.name}
                            </span>
                            {isFreeloaderSkull && (
                              <span
                                title={`${fm.sharePercent.toFixed(1)}% share (< 15%)`}
                                className="p5-tag inline-flex items-center border border-bt-red/60 bg-bt-red/15 px-2 py-0.5 text-bt-red shrink-0"
                              >
                                <span className="p5-unskew inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider">
                                  <Skull className="h-3 w-3" aria-hidden="true" />
                                  &lt;15%
                                </span>
                              </span>
                            )}
                            {fm.isUpNext && (
                              <span className="p5-tag inline-flex items-center bg-bt-red px-2 py-0.5 text-white shrink-0">
                                <span className="p5-unskew font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
                                  UP NEXT
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
                            <span className="text-bt-muted">
                              {formatMoney(fm.totalRawValue)}{" "}
                              <span className="text-bt-dim">|</span>{" "}
                              <span className="text-white">
                                {fm.sharePercent.toFixed(1)}%
                              </span>
                              <span className="text-bt-muted">
                                /{fm.expectedSharePercent.toFixed(1)}%
                              </span>
                            </span>
                            <span
                              className={`min-w-[82px] text-right font-bold ${
                                isNeutral
                                  ? "text-white"
                                  : isAhead
                                    ? "text-emerald-400"
                                    : "text-bt-red"
                              }`}
                            >
                              {formatSignedMoney(fm.deltaFromAverageValue)}
                            </span>
                          </div>
                        </div>

                        {/* Diverging Bar Track */}
                        <div
                          className="mt-3 relative grid grid-cols-2 h-3.5 w-full bg-bt-bg border border-bt-border/80 overflow-visible"
                          title={`${fm.name}: ${formatSignedMoney(fm.deltaFromAverageValue)} vs. ${formatMoney(analysis.fairness.averageRawValue)} average`}
                        >
                          {/* Left Half (Deficit -> extends left from center in BelTeez Red) */}
                          <div className="flex justify-end items-center h-full overflow-visible">
                            {!isNeutral && !isAhead && (
                              <div
                                className="relative h-full bg-bt-red transition-all duration-300"
                                style={{ width: `${visualWidth}%` }}
                              >
                                {isFreeloaderSkull && (
                                  <span
                                    title={`${fm.name}: ${fm.sharePercent.toFixed(1)}% share (< 15%)`}
                                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-sm border border-bt-red bg-bt-bg shadow-[0_0_10px_rgb(var(--bt-accent-rgb)/0.6)]"
                                  >
                                    <Skull
                                      className="h-4 w-4 text-bt-red"
                                      aria-hidden="true"
                                    />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right Half (Surplus -> extends right from center in Emerald) */}
                          <div className="flex justify-start h-full overflow-hidden">
                            {!isNeutral && isAhead && (
                              <div
                                className="h-full bg-emerald-400 transition-all duration-300"
                                style={{ width: `${visualWidth}%` }}
                              />
                            )}
                          </div>

                          {/* Center Zero-Axis Hairline */}
                          <div
                            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/80"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
