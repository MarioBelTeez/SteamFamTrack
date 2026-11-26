"use client";

import { useMemo, useState } from "react";
import {
  MONTH_KEY_REGEX,
  WEEK_KEY_REGEX,
  computeMemberStreaks,
  filterSnapshotsByMode,
  getIsoWeekKey,
  getMonthKey,
  SnapshotPeriodMode,
} from "@/lib/snapshot-periods";
import {
  FamilyAnalysis,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  Calendar,
  Camera,
  Flame,
  Loader2,
  Save,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface MonthlyHistoryProps {
  slug?: string;
  analysis: FamilyAnalysis;
  snapshots: MonthlySnapshotRecord[];
  hasDatabase: boolean;
  onSaveSnapshot?: (periodKey: string) => Promise<void>;
  onOpenSaveModal?: () => void;
}

export function MonthlyHistory({
  slug,
  analysis,
  snapshots,
  hasDatabase,
  onSaveSnapshot,
  onOpenSaveModal,
}: MonthlyHistoryProps) {
  const [mode, setMode] = useState<SnapshotPeriodMode>("monthly");
  const [saving, setSaving] = useState(false);
  const [customPeriodKey, setCustomPeriodKey] = useState<string | null>(null);

  const sym = STEAM_REGIONS[analysis.region].symbol;
  const defaultPeriodKey = useMemo(
    () => (mode === "weekly" ? getIsoWeekKey() : getMonthKey()),
    [mode]
  );
  const periodKey = customPeriodKey ?? defaultPeriodKey;
  const isValidPeriod =
    mode === "weekly"
      ? WEEK_KEY_REGEX.test(periodKey.trim())
      : MONTH_KEY_REGEX.test(periodKey.trim());
  const unitLabel = mode === "weekly" ? "W" : "M";

  const modeSnapshots = useMemo(
    () => filterSnapshotsByMode(snapshots, mode),
    [snapshots, mode]
  );

  const streaks = useMemo(
    () => computeMemberStreaks(modeSnapshots),
    [modeSnapshots]
  );

  const formatDeltaMoney = (
    val: number,
    regionCode: SteamRegion = analysis.region
  ) => {
    const regionSym = STEAM_REGIONS[regionCode]?.symbol ?? sym;
    const sign = val > 0 ? "+" : val < 0 ? "-" : "";
    const abs = Math.abs(val);
    if (regionCode === "jp") {
      return `${sign}${regionSym}${Math.round(abs).toLocaleString()}`;
    }
    return `${sign}${regionSym}${abs.toFixed(2)}`;
  };

  const formatAbsMoney = (val: number, regionCode: SteamRegion) => {
    const regionSym = STEAM_REGIONS[regionCode]?.symbol ?? "$";
    const abs = Math.abs(val);
    if (regionCode === "jp") {
      return `${regionSym}${Math.round(abs).toLocaleString()}`;
    }
    return `${regionSym}${abs.toFixed(2)}`;
  };

  const diff = useMemo(() => {
    if (modeSnapshots.length < 2) return null;
    const latest = modeSnapshots[0];
    const prev = modeSnapshots[1];

    const prevMap = new Map(prev.memberBreakdown.map((m) => [m.name, m]));
    const memberDeltas = latest.memberBreakdown.map((m) => {
      const p = prevMap.get(m.name);
      return {
        name: m.name,
        gamesDelta: m.totalGames - (p?.totalGames ?? 0),
        valueDelta:
          Math.round((m.totalRawValue - (p?.totalRawValue ?? 0)) * 100) / 100,
        shareDelta:
          Math.round((m.sharePercent - (p?.sharePercent ?? 0)) * 100) / 100,
        latestValue: m.totalRawValue,
        latestShare: m.sharePercent,
      };
    });

    memberDeltas.sort(
      (a, b) => b.valueDelta - a.valueDelta || b.gamesDelta - a.gamesDelta
    );

    const maxPositiveValueDelta = Math.max(
      1,
      ...memberDeltas.map((m) => Math.max(0, m.valueDelta))
    );

    const topBuyer =
      memberDeltas.find((m) => m.gamesDelta > 0 || m.valueDelta > 0) ?? null;

    let bestHotStreak: { name: string; count: number } | null = null;
    let worstDryStreak: { name: string; count: number } | null = null;

    for (const [name, s] of streaks.entries()) {
      if (s.kind === "buying") {
        if (!bestHotStreak || s.count > bestHotStreak.count) {
          bestHotStreak = { name, count: s.count };
        }
      } else if (!worstDryStreak || s.count > worstDryStreak.count) {
        worstDryStreak = { name, count: s.count };
      }
    }

    return {
      latestPeriod: latest.snapshotMonth,
      prevPeriod: prev.snapshotMonth,
      uniqueGamesDelta: latest.uniqueGamesCount - prev.uniqueGamesCount,
      uniqueValueDelta:
        Math.round((latest.uniqueCatalogValue - prev.uniqueCatalogValue) * 100) /
        100,
      maxPositiveValueDelta,
      topBuyer,
      bestHotStreak,
      worstDryStreak,
      memberDeltas,
    };
  }, [modeSnapshots, streaks]);

  const handleModeSwitch = (nextMode: SnapshotPeriodMode) => {
    setMode(nextMode);
    setCustomPeriodKey(null);
  };

  const handleRecord = async () => {
    if (!onSaveSnapshot || !isValidPeriod) return;
    setSaving(true);
    try {
      await onSaveSnapshot(periodKey.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Snapshot Capture & Mode Switcher Strip */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 h-10 w-1 shrink-0 bg-bt-red"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl tracking-wider uppercase text-white leading-none">
                  {mode === "weekly"
                    ? "Weekly Contribution Ledger"
                    : "Monthly Contribution Ledger"}
                </h2>
                <div className="inline-flex border border-bt-border bg-bt-bg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("monthly")}
                    className={`cursor-pointer px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      mode === "monthly"
                        ? "bg-bt-red text-white font-semibold"
                        : "text-bt-muted hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("weekly")}
                    className={`cursor-pointer px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      mode === "weekly"
                        ? "bg-bt-red text-white font-semibold"
                        : "text-bt-muted hover:text-white"
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-bt-muted">
                Track {mode === "weekly" ? "week-over-week" : "month-over-month"}{" "}
                purchases, regional value added, and buying vs. dry-spell streaks.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="snapshot-period-input"
                className="font-condensed text-[11px] font-bold uppercase tracking-widest text-bt-muted"
              >
                {mode === "weekly" ? "Week" : "Month"}
              </label>
              <input
                id="snapshot-period-input"
                type="text"
                value={periodKey}
                onChange={(e) => setCustomPeriodKey(e.target.value)}
                disabled={!slug || saving}
                placeholder={mode === "weekly" ? "YYYY-Www" : "YYYY-MM"}
                maxLength={8}
                aria-invalid={!isValidPeriod}
                className={`w-28 border bg-bt-bg px-3 py-2 font-mono text-sm tabular-nums text-white placeholder:text-bt-dim focus:outline-none disabled:opacity-50 ${
                  isValidPeriod
                    ? "border-bt-border focus:border-bt-red"
                    : "border-bt-red"
                }`}
              />
            </div>

            {slug ? (
              <button
                type="button"
                onClick={handleRecord}
                disabled={saving || !isValidPeriod || !onSaveSnapshot}
                className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-5 py-2.5 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Record {mode === "weekly" ? "Week" : "Month"}
              </button>
            ) : hasDatabase && onOpenSaveModal ? (
              <button
                type="button"
                onClick={onOpenSaveModal}
                className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-5 py-2.5 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save Group First
              </button>
            ) : (
              <span className="border border-bt-border bg-bt-elevated px-3 py-2 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted">
                Database Required
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Group Callout */}
      {!slug ? (
        <div className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl tracking-wider uppercase text-white">
              Save Your Group to Unlock Weekly &amp; Monthly Streaks
            </h3>
            <p className="mx-auto max-w-md text-sm text-bt-muted">
              Checkpoints persist each week&apos;s and month&apos;s contribution
              breakdown so your Steam Family can track buying streaks, dry
              spells, and catalog growth over time.
            </p>
            {hasDatabase && onOpenSaveModal && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onOpenSaveModal}
                  className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-6 py-2.5 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
                >
                  Save &amp; Share Family Group
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Vivid Summary & Streak KPI Strip */}
          {diff && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-bt-surface to-bt-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                      Catalog Growth
                    </span>
                    {diff.uniqueGamesDelta >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-bt-red" />
                    )}
                  </div>
                  <div
                    className={`mt-3 font-display text-4xl tracking-wide tabular-nums leading-none ${
                      diff.uniqueGamesDelta >= 0
                        ? "text-emerald-400"
                        : "text-bt-red"
                    }`}
                  >
                    {diff.uniqueGamesDelta >= 0 ? "+" : ""}
                    {diff.uniqueGamesDelta} GAMES
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-bt-muted">
                    {diff.prevPeriod} → {diff.latestPeriod}
                  </div>
                </div>

                <div className="border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-bt-surface to-bt-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                      Value Added
                    </span>
                    <span className="font-mono text-[10px] uppercase text-amber-200">
                      {analysis.region.toUpperCase()}
                    </span>
                  </div>
                  <div
                    className={`mt-3 font-display text-4xl tracking-wide tabular-nums leading-none ${
                      diff.uniqueValueDelta >= 0
                        ? "text-amber-300"
                        : "text-bt-red"
                    }`}
                  >
                    {formatDeltaMoney(diff.uniqueValueDelta)}
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-bt-muted">
                    {diff.prevPeriod} → {diff.latestPeriod}
                  </div>
                </div>

                <div className="border border-bt-red/50 bg-gradient-to-br from-bt-red/20 via-bt-surface to-bt-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-red">
                      Period MVP Buyer
                    </span>
                    <Trophy className="h-4 w-4 text-bt-red" />
                  </div>
                  <div className="mt-3 font-display text-3xl tracking-wide uppercase text-white truncate">
                    {diff.topBuyer ? diff.topBuyer.name : "NO NEW BUYS"}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-emerald-400 tabular-nums">
                    {diff.topBuyer
                      ? `+${diff.topBuyer.gamesDelta} games · ${formatDeltaMoney(
                          diff.topBuyer.valueDelta
                        )}`
                      : "Waiting on next purchase"}
                  </div>
                </div>

                <div className="border border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 via-bt-surface to-bt-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                      Streak Radar
                    </span>
                    <Flame className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-mono text-amber-300">
                        <Flame className="h-3.5 w-3.5" />
                        {diff.bestHotStreak
                          ? `${diff.bestHotStreak.name}`
                          : "No buy streak"}
                      </span>
                      {diff.bestHotStreak && (
                        <span className="font-mono font-bold text-amber-300 tabular-nums">
                          {diff.bestHotStreak.count}
                          {unitLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-mono text-cyan-300">
                        <Snowflake className="h-3.5 w-3.5" />
                        {diff.worstDryStreak
                          ? `${diff.worstDryStreak.name}`
                          : "No dry spell"}
                      </span>
                      {diff.worstDryStreak && (
                        <span className="font-mono font-bold text-cyan-300 tabular-nums">
                          {diff.worstDryStreak.count}
                          {unitLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vivid Member Period Diff & Streak Table */}
              <div className="p5-frame bg-bt-border">
                <div className="bg-bt-surface overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bt-border px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="h-5 w-1 bg-bt-red" />
                      <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                        Member Deltas &amp; Streaks ({diff.prevPeriod} →{" "}
                        {diff.latestPeriod})
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bt-muted">
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Flame className="h-3 w-3" aria-hidden="true" />
                        BUY STREAK
                      </span>
                      <span className="text-bt-dim">·</span>
                      <span className="inline-flex items-center gap-1 text-cyan-300">
                        <Snowflake className="h-3 w-3" aria-hidden="true" />
                        DRY SPELL
                      </span>
                    </span>
                  </div>

                  <div className="divide-y divide-bt-border/60">
                    {diff.memberDeltas.map((m) => {
                      const streak = streaks.get(m.name);
                      const barWidth =
                        m.valueDelta > 0
                          ? Math.max(
                              8,
                              Math.round(
                                (m.valueDelta / diff.maxPositiveValueDelta) * 100
                              )
                            )
                          : 0;

                      return (
                        <div
                          key={m.name}
                          className="px-5 py-3.5 hover:bg-bt-elevated/50 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                              <span className="font-condensed text-base font-bold uppercase tracking-wider text-white">
                                {m.name}
                              </span>
                              {streak?.kind === "buying" && (
                                <span className="inline-flex items-center gap-1 border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 tabular-nums">
                                  <Flame className="h-3 w-3 text-amber-400" />
                                  {streak.count}
                                  {unitLabel} BUY STREAK
                                </span>
                              )}
                              {streak?.kind === "dry" && streak.count >= 2 && (
                                <span className="inline-flex items-center gap-1 border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 tabular-nums">
                                  <Snowflake className="h-3 w-3 text-cyan-300" />
                                  {streak.count}
                                  {unitLabel} NO BUYS
                                </span>
                              )}
                              {streak?.kind === "dry" && streak.count === 1 && (
                                <span className="inline-flex items-center gap-1 border border-bt-border bg-bt-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bt-dim tabular-nums">
                                  0 NEW THIS {mode === "weekly" ? "WEEK" : "MONTH"}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
                              <span
                                className={
                                  m.gamesDelta > 0
                                    ? "text-emerald-400 font-bold"
                                    : m.gamesDelta < 0
                                    ? "text-bt-red font-bold"
                                    : "text-bt-dim"
                                }
                              >
                                {m.gamesDelta > 0 ? "+" : ""}
                                {m.gamesDelta} games
                              </span>
                              <span
                                className={
                                  m.valueDelta > 0
                                    ? "text-amber-300 font-bold"
                                    : m.valueDelta < 0
                                    ? "text-bt-red font-bold"
                                    : "text-bt-dim"
                                }
                              >
                                {formatDeltaMoney(m.valueDelta)}
                              </span>
                              <span
                                className={`min-w-[60px] text-right ${
                                  m.shareDelta > 0
                                    ? "text-emerald-400"
                                    : m.shareDelta < 0
                                    ? "text-bt-red"
                                    : "text-bt-dim"
                                }`}
                              >
                                {m.shareDelta > 0 ? "+" : ""}
                                {m.shareDelta.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Vivid activity bar */}
                          <div className="mt-2 h-1.5 w-full bg-bt-bg overflow-hidden">
                            {barWidth > 0 ? (
                              <div
                                className="h-full bg-gradient-to-r from-bt-red via-amber-400 to-emerald-400 transition-all"
                                style={{ width: `${barWidth}%` }}
                              />
                            ) : (
                              <div className="h-full w-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recorded Checkpoints List */}
          <div className="p5-frame bg-bt-border">
            <div className="bg-bt-surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bt-border pb-3">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-5 w-1 bg-bt-red" />
                  <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                    Saved {mode === "weekly" ? "Weekly" : "Monthly"} Checkpoints
                    ({modeSnapshots.length})
                  </h3>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-bt-muted">
                  Auto-captured daily at 04:15 UTC+1
                </span>
              </div>

              {modeSnapshots.length === 0 ? (
                <div className="border border-dashed border-bt-border bg-bt-bg/50 p-6 text-center text-sm text-bt-muted">
                  No {mode} snapshots recorded yet. Click{" "}
                  <span className="text-white font-semibold">
                    Record {mode === "weekly" ? "Week" : "Month"}
                  </span>{" "}
                  above to save your first baseline checkpoint.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {modeSnapshots.map((snap, idx) => (
                    <div
                      key={snap.id}
                      className={`border p-4 space-y-2 ${
                        idx === 0
                          ? "border-bt-red/70 bg-bt-red/10"
                          : "border-bt-border bg-bt-bg/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-white tabular-nums">
                          {snap.snapshotMonth}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-bt-muted">
                          {snap.region.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-2xl text-emerald-400 tabular-nums">
                          {snap.uniqueGamesCount} GAMES
                        </span>
                        <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                          {formatAbsMoney(snap.uniqueCatalogValue, snap.region)}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-bt-dim">
                        {snap.memberBreakdown.length} members tracked
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
