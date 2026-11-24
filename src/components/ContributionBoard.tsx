"use client";

import { FamilyAnalysis } from "@/lib/types";
import { Award, CheckCircle2, Clock, Layers, Library, ShieldAlert } from "lucide-react";

interface ContributionBoardProps {
  analysis: FamilyAnalysis;
}

export function ContributionBoard({ analysis }: ContributionBoardProps) {
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Unique Catalog</span>
            <Library className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {analysis.uniqueGamesCount} games
          </div>
          <div className="mt-1 text-sm text-sky-300 font-mono">
            {formatMoney(analysis.uniqueCatalogValue)} raw value
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Sum of All Copies</span>
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {analysis.sumCopiesCount} copies
          </div>
          <div className="mt-1 text-sm text-slate-400 font-mono">
            {formatMoney(analysis.sumCopiesValue)} total
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Top Contributor</span>
            <Award className="h-4 w-4 text-lime-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white truncate">
            {top ? top.name : "—"}
          </div>
          <div className="mt-1 text-sm text-lime-400 font-mono">
            {top ? `${top.sharePercent.toFixed(1)}% · ${formatMoney(top.totalRawValue)}` : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Sharing Excluded</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {analysis.excludedGamesCount} copies
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Publisher opted out of Family Sharing
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">
              Member Contribution Breakdown
            </h2>
            <p className="text-xs text-slate-400">
              Ranked by raw non-discounted regional store value ({analysis.region.toUpperCase()})
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {analysis.members.length} / 6 Steam Family slots used
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Member</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Exclusive</th>
                <th className="px-4 py-3 text-right">Shared</th>
                <th className="px-4 py-3 text-right">Raw Value</th>
                <th className="px-4 py-3 text-right">Excl. Value</th>
                <th className="px-5 py-3 min-w-[170px]">Contribution Share</th>
                <th className="px-5 py-3">1-Yr Slot Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {analysis.members.map((m, idx) => (
                <tr
                  key={m.memberId}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatarUrl}
                          alt={m.name}
                          className="h-8 w-8 rounded-md border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md border border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-bold text-sky-400">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-white">{m.name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[160px]">
                          {m.personaName !== m.name ? m.personaName : m.steamId64}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-200">
                    {m.totalGames}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sky-300">
                    {m.exclusiveGames}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-400">
                    {m.sharedGames}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold text-white">
                    {formatMoney(m.totalRawValue)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                    {formatMoney(m.exclusiveValue)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-lime-400"
                          style={{ width: `${Math.min(100, m.sharePercent)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-xs font-semibold text-white">
                        {m.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {m.cooldown.isSlotUnlocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-500/10 px-2.5 py-1 text-xs font-medium text-lime-400 border border-lime-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Unlocked
                      </span>
                    ) : (
                      <span
                        title={`Joined ${m.cooldown.joinDate} · Unlocks ${m.cooldown.slotUnlockDate}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {m.cooldown.daysUntilUnlock}d ({m.cooldown.slotUnlockDate})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
