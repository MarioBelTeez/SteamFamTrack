"use client";

import { useMemo, useState } from "react";
import {
  FamilyAnalysis,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
} from "@/lib/types";
import { Calendar, Camera, Loader2, TrendingUp } from "lucide-react";

interface MonthlyHistoryProps {
  slug?: string;
  analysis: FamilyAnalysis;
  snapshots: MonthlySnapshotRecord[];
  hasDatabase: boolean;
  onSaveSnapshot?: (monthKey: string) => Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sym = STEAM_REGIONS[analysis.region].symbol;

  const formatDeltaMoney = (val: number) => {
    const sign = val > 0 ? "+" : val < 0 ? "-" : "";
    const abs = Math.abs(val);
    if (analysis.region === "jp") {
      return `${sign}${sym}${Math.round(abs).toLocaleString()}`;
    }
    return `${sign}${sym}${abs.toFixed(2)}`;
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
        valueDelta: Math.round((m.totalRawValue - (p?.totalRawValue ?? 0)) * 100) / 100,
        shareDelta: Math.round((m.sharePercent - (p?.sharePercent ?? 0)) * 100) / 100,
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
    if (!onSaveSnapshot) return;
    setSaving(true);
    try {
      await onSaveSnapshot(currentMonth);
    } finally {
      setSaving(false);
    }
  };

  if (!slug) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center space-y-3">
        <Calendar className="h-8 w-8 text-sky-400 mx-auto" />
        <h3 className="text-base font-semibold text-white">
          Save Your Group to Unlock Monthly Snapshots
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Monthly delta tracking stores each month&apos;s contribution breakdown so your family can see who added the most games and value every month.
        </p>
        {hasDatabase && onOpenSaveModal && (
          <button
            onClick={onOpenSaveModal}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            Save &amp; Share Family Group
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Monthly Contribution Snapshots
          </h2>
          <p className="text-xs text-slate-400">
            Record a snapshot once a month to diff new games, regional value added, and % share shifts.
          </p>
        </div>

        <button
          onClick={handleRecord}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          Record {currentMonth} Snapshot
        </button>
      </div>

      {diff && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
                <span>
                  Catalog Growth ({diff.prevMonth} → {diff.latestMonth})
                </span>
                <TrendingUp className="h-4 w-4 text-lime-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white font-mono">
                {diff.uniqueGamesDelta >= 0 ? "+" : ""}
                {diff.uniqueGamesDelta} unique games
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Value Added ({diff.prevMonth} → {diff.latestMonth})
              </div>
              <div className="mt-2 text-2xl font-bold text-lime-400 font-mono">
                {formatDeltaMoney(diff.uniqueValueDelta)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-white">
                Member Deltas ({diff.prevMonth} → {diff.latestMonth})
              </h3>
            </div>
            <div className="divide-y divide-slate-800/70">
              {diff.memberDeltas.map((m) => (
                <div
                  key={m.name}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <span className="font-medium text-white">{m.name}</span>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span
                      className={
                        m.gamesDelta > 0
                          ? "text-lime-400"
                          : m.gamesDelta < 0
                          ? "text-rose-400"
                          : "text-slate-500"
                      }
                    >
                      {m.gamesDelta >= 0 ? "+" : ""}
                      {m.gamesDelta} games
                    </span>
                    <span
                      className={
                        m.valueDelta > 0
                          ? "text-lime-400"
                          : m.valueDelta < 0
                          ? "text-rose-400"
                          : "text-slate-500"
                      }
                    >
                      {formatDeltaMoney(m.valueDelta)}
                    </span>
                    <span
                      className={`w-16 text-right ${
                        m.shareDelta > 0
                          ? "text-sky-300"
                          : m.shareDelta < 0
                          ? "text-rose-400"
                          : "text-slate-500"
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
      )}

      {/* Snapshot Timeline */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-white">
            Saved Snapshots ({snapshots.length})
          </h3>
        </div>
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No monthly snapshots saved yet. Click &ldquo;Record {currentMonth} Snapshot&rdquo; to establish your baseline.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {snapshots.map((snap) => {
              const snapSym = STEAM_REGIONS[snap.region]?.symbol ?? "$";
              return (
                <div
                  key={snap.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-slate-800 px-2.5 py-1 font-mono text-xs font-semibold text-sky-300">
                      {snap.snapshotMonth}
                    </span>
                    <span className="text-slate-300">
                      {snap.uniqueGamesCount} unique games ({snap.sumCopiesCount} copies)
                    </span>
                  </div>
                  <div className="font-mono text-sm font-semibold text-white">
                    {snapSym}
                    {snap.uniqueCatalogValue.toFixed(2)}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({snap.region.toUpperCase()})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
