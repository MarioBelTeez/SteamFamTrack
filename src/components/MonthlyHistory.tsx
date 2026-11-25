"use client";

import { useMemo, useState } from "react";
import {
  FamilyAnalysis,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  Calendar,
  Camera,
  Loader2,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface MonthlyHistoryProps {
  slug?: string;
  analysis: FamilyAnalysis;
  snapshots: MonthlySnapshotRecord[];
  hasDatabase: boolean;
  onSaveSnapshot?: (monthKey: string) => Promise<void>;
  onOpenSaveModal?: () => void;
}

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function MonthlyHistory({
  slug,
  analysis,
  snapshots,
  hasDatabase,
  onSaveSnapshot,
  onOpenSaveModal,
}: MonthlyHistoryProps) {
  const [saving, setSaving] = useState(false);
  const [monthKey, setMonthKey] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const sym = STEAM_REGIONS[analysis.region].symbol;
  const isValidMonth = MONTH_KEY_REGEX.test(monthKey.trim());

  const formatDeltaMoney = (val: number, regionCode: SteamRegion = analysis.region) => {
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
    if (snapshots.length < 2) return null;
    const latest = snapshots[0];
    const prev = snapshots[1];

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

    memberDeltas.sort((a, b) => b.valueDelta - a.valueDelta);

    return {
      latestMonth: latest.snapshotMonth,
      prevMonth: prev.snapshotMonth,
      uniqueGamesDelta: latest.uniqueGamesCount - prev.uniqueGamesCount,
      uniqueValueDelta:
        Math.round((latest.uniqueCatalogValue - prev.uniqueCatalogValue) * 100) /
        100,
      memberDeltas,
    };
  }, [snapshots]);

  const handleRecord = async () => {
    if (!onSaveSnapshot || !isValidMonth) return;
    setSaving(true);
    try {
      await onSaveSnapshot(monthKey.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Snapshot Capture Strip */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="tier-rail mt-0.5 h-10 w-1 shrink-0 bg-bt-red" />
            <div>
              <h2 className="font-display text-2xl tracking-wider uppercase text-white leading-none">
                Monthly Contribution Snapshots
              </h2>
              <p className="mt-1 text-xs text-bt-muted">
                Capture a monthly ledger checkpoint to diff new games, regional
                value added, and member % share shifts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="snapshot-month-input"
                className="font-condensed text-[11px] font-bold uppercase tracking-widest text-bt-muted"
              >
                Month
              </label>
              <input
                id="snapshot-month-input"
                type="text"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                disabled={!slug || saving}
                placeholder="YYYY-MM"
                maxLength={7}
                aria-invalid={!isValidMonth}
                className={`w-28 border bg-bt-bg px-3 py-2 font-mono text-sm tabular-nums text-white placeholder:text-bt-dim focus:outline-none disabled:opacity-50 ${
                  isValidMonth
                    ? "border-bt-border focus:border-bt-red"
                    : "border-bt-red"
                }`}
              />
            </div>

            {slug ? (
              <button
                type="button"
                onClick={handleRecord}
                disabled={saving || !isValidMonth || !onSaveSnapshot}
                className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-5 py-2.5 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Record Snapshot
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
              Save Your Group to Unlock Monthly Snapshots
            </h3>
            <p className="mx-auto max-w-md text-sm text-bt-muted">
              Monthly delta tracking persists each month&apos;s contribution
              breakdown so your Steam Family can audit who added the most games
              and regional value over time.
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
          {/* Latest vs Previous Month Delta Summary Cards */}
          {diff && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p5-frame bg-bt-border">
                  <div className="bg-bt-surface p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                        Catalog Growth ({diff.prevMonth} → {diff.latestMonth})
                      </span>
                      {diff.uniqueGamesDelta >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-bt-red" />
                      )}
                    </div>
                    <div
                      className={`mt-3 font-display text-4xl sm:text-5xl tracking-wide tabular-nums leading-none ${
                        diff.uniqueGamesDelta >= 0
                          ? "text-emerald-400"
                          : "text-bt-red"
                      }`}
                    >
                      {diff.uniqueGamesDelta >= 0 ? "+" : ""}
                      {diff.uniqueGamesDelta} UNIQUE GAMES
                    </div>
                  </div>
                </div>

                <div className="p5-frame bg-bt-border">
                  <div className="bg-bt-surface p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                        Value Added ({diff.prevMonth} → {diff.latestMonth})
                      </span>
                      <span className="font-mono text-[11px] uppercase text-bt-muted">
                        {analysis.region.toUpperCase()}
                      </span>
                    </div>
                    <div
                      className={`mt-3 font-display text-4xl sm:text-5xl tracking-wide tabular-nums leading-none ${
                        diff.uniqueValueDelta >= 0
                          ? "text-emerald-400"
                          : "text-bt-red"
                      }`}
                    >
                      {formatDeltaMoney(diff.uniqueValueDelta)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest Month Member Delta Leaderboard */}
              <div className="p5-frame bg-bt-border">
                <div className="bg-bt-surface overflow-hidden">
                  <div className="flex items-center justify-between border-b border-bt-border px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="tier-rail h-5 w-1 bg-bt-red" />
                      <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                        Member Deltas ({diff.prevMonth} → {diff.latestMonth})
                      </h3>
                    </div>
                  </div>
                  <div className="divide-y divide-bt-border/60">
                    {diff.memberDeltas.map((m) => (
                      <div
                        key={m.name}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-bt-elevated/50"
                      >
                        <span className="font-medium text-white">{m.name}</span>
                        <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
                          <span
                            className={
                              m.gamesDelta > 0
                                ? "text-emerald-400"
                                : m.gamesDelta < 0
                                ? "text-bt-red"
                                : "text-bt-muted"
                            }
                          >
                            {m.gamesDelta >= 0 ? "+" : ""}
                            {m.gamesDelta} games
                          </span>
                          <span
                            className={`font-semibold ${
                              m.valueDelta > 0
                                ? "text-emerald-400"
                                : m.valueDelta < 0
                                ? "text-bt-red"
                                : "text-bt-muted"
                            }`}
                          >
                            {formatDeltaMoney(m.valueDelta)}
                          </span>
                          <span
                            className={`w-16 text-right ${
                              m.shareDelta > 0
                                ? "text-emerald-400"
                                : m.shareDelta < 0
                                ? "text-bt-red"
                                : "text-bt-muted"
                            }`}
                          >
                            {m.shareDelta >= 0 ? "+" : ""}
                            {m.shareDelta.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editorial Snapshot Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="tier-rail h-5 w-1 bg-bt-red" />
                <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                  Snapshot Timeline ({snapshots.length})
                </h3>
              </div>
            </div>

            {snapshots.length === 0 ? (
              <div className="p5-frame bg-bt-border">
                <div className="bg-bt-surface p-10 text-center text-sm text-bt-muted">
                  No monthly snapshots saved yet. Enter a month key and click
                  &ldquo;Record Snapshot&rdquo; to establish your baseline.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {snapshots.map((snap, idx) => {
                  const prevSnap = snapshots[idx + 1] ?? null;
                  const prevMemberMap = prevSnap
                    ? new Map(prevSnap.memberBreakdown.map((m) => [m.name, m]))
                    : null;
                  const gamesDiff = prevSnap
                    ? snap.uniqueGamesCount - prevSnap.uniqueGamesCount
                    : null;
                  const valueDiff = prevSnap
                    ? Math.round(
                        (snap.uniqueCatalogValue - prevSnap.uniqueCatalogValue) *
                          100
                      ) / 100
                    : null;

                  return (
                    <article
                      key={snap.id}
                      className="border-y border-r border-bt-border border-l-2 border-l-bt-red bg-bt-surface overflow-hidden"
                    >
                      {/* Snapshot Header Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bt-border bg-bt-elevated/60 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`p5-tag px-3 py-1 font-mono text-xs font-bold tabular-nums ${
                              idx === 0
                                ? "bg-bt-red text-white"
                                : "border border-bt-border bg-bt-bg text-white"
                            }`}
                          >
                            <span className="p5-unskew inline-block">
                              {snap.snapshotMonth}
                            </span>
                          </span>
                          {idx === 0 && (
                            <span className="font-condensed text-[11px] font-bold uppercase tracking-widest text-bt-red">
                              Latest Checkpoint
                            </span>
                          )}
                          <span className="font-mono text-xs tabular-nums text-bt-muted">
                            {snap.uniqueGamesCount} unique games (
                            {snap.sumCopiesCount} copies)
                          </span>
                          {gamesDiff !== null && (
                            <span
                              className={`font-mono text-xs font-semibold tabular-nums ${
                                gamesDiff > 0
                                  ? "text-emerald-400"
                                  : gamesDiff < 0
                                  ? "text-bt-red"
                                  : "text-bt-muted"
                              }`}
                            >
                              {gamesDiff >= 0 ? "+" : ""}
                              {gamesDiff}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-3 font-mono tabular-nums">
                          <span className="font-display text-2xl tracking-wide text-white leading-none">
                            {formatAbsMoney(snap.uniqueCatalogValue, snap.region)}
                          </span>
                          {valueDiff !== null && (
                            <span
                              className={`text-xs font-semibold ${
                                valueDiff > 0
                                  ? "text-emerald-400"
                                  : valueDiff < 0
                                  ? "text-bt-red"
                                  : "text-bt-muted"
                              }`}
                            >
                              ({formatDeltaMoney(valueDiff, snap.region)})
                            </span>
                          )}
                          <span className="text-[11px] uppercase text-bt-muted">
                            {snap.region.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Per-Member Breakdown Table */}
                      {snap.memberBreakdown.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-bt-border/80 bg-bt-bg/50 font-condensed text-[11px] font-bold uppercase tracking-[0.16em] text-bt-muted">
                                <th className="px-5 py-2">Member</th>
                                <th className="px-4 py-2 text-right">Games</th>
                                <th className="px-4 py-2 text-right">
                                  Exclusive
                                </th>
                                <th className="px-4 py-2 text-right">
                                  Raw Value
                                </th>
                                <th className="px-5 py-2 text-right">
                                  Share %
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-bt-border/50 text-xs">
                              {snap.memberBreakdown.map((m) => {
                                const prevM = prevMemberMap?.get(m.name);
                                const mGamesDelta = prevM
                                  ? m.totalGames - prevM.totalGames
                                  : null;
                                const mValDelta = prevM
                                  ? Math.round(
                                      (m.totalRawValue - prevM.totalRawValue) *
                                        100
                                    ) / 100
                                  : null;
                                const mShareDelta = prevM
                                  ? Math.round(
                                      (m.sharePercent - prevM.sharePercent) *
                                        100
                                    ) / 100
                                  : null;

                                return (
                                  <tr
                                    key={`${snap.id}-${m.steamId64 || m.name}`}
                                    className="transition-colors hover:bg-bt-elevated/40"
                                  >
                                    <td className="px-5 py-2.5 text-sm font-medium text-white">
                                      {m.name}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                                      <span>{m.totalGames}</span>
                                      {mGamesDelta !== null &&
                                        mGamesDelta !== 0 && (
                                          <span
                                            className={`ml-2 text-[11px] ${
                                              mGamesDelta > 0
                                                ? "text-emerald-400"
                                                : "text-bt-red"
                                            }`}
                                          >
                                            {mGamesDelta > 0 ? "+" : ""}
                                            {mGamesDelta}
                                          </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-bt-muted">
                                      {m.exclusiveGames}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                                      <span>
                                        {formatAbsMoney(
                                          m.totalRawValue,
                                          snap.region
                                        )}
                                      </span>
                                      {mValDelta !== null && mValDelta !== 0 && (
                                        <span
                                          className={`ml-2 text-[11px] ${
                                            mValDelta > 0
                                              ? "text-emerald-400"
                                              : "text-bt-red"
                                          }`}
                                        >
                                          {formatDeltaMoney(
                                            mValDelta,
                                            snap.region
                                          )}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-white">
                                      <span className="font-semibold">
                                        {m.sharePercent.toFixed(1)}%
                                      </span>
                                      {mShareDelta !== null &&
                                        mShareDelta !== 0 && (
                                          <span
                                            className={`ml-2 text-[11px] ${
                                              mShareDelta > 0
                                                ? "text-emerald-400"
                                                : "text-bt-red"
                                            }`}
                                          >
                                            {mShareDelta > 0 ? "+" : ""}
                                            {mShareDelta.toFixed(1)}%
                                          </span>
                                        )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
