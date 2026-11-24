"use client";

import { useMemo, useState } from "react";
import { FamilyAnalysis } from "@/lib/types";
import { Search, ShieldAlert } from "lucide-react";

interface OverlapAndCatalogProps {
  analysis: FamilyAnalysis;
}

type CatalogFilter = "all" | "exclusive" | "shared" | "excluded";

export function OverlapAndCatalog({ analysis }: OverlapAndCatalogProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const sym = analysis.currencySymbol;

  const formatMoney = (val: number) => {
    if (val === 0) return "Free";
    if (analysis.region === "jp") return `${sym}${Math.round(val).toLocaleString()}`;
    return `${sym}${val.toFixed(2)}`;
  };

  const maxOffDiagonal = useMemo(() => {
    let max = 1;
    for (const mA of analysis.members) {
      for (const mB of analysis.members) {
        if (mA.memberId === mB.memberId) continue;
        const val = analysis.overlapMatrix[mA.memberId]?.[mB.memberId] ?? 0;
        if (val > max) max = val;
      }
    }
    return max;
  }, [analysis]);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysis.catalog.filter((entry) => {
      if (q && !entry.game.name.toLowerCase().includes(q)) return false;
      if (filter === "exclusive" && !entry.isExclusive) return false;
      if (filter === "shared" && entry.isExclusive) return false;
      if (filter === "excluded" && !entry.game.familySharingExcluded) return false;
      return true;
    });
  }, [analysis.catalog, query, filter]);

  return (
    <div className="space-y-6">
      {/* Overlap Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">
            Library Overlap Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Diagonal shows each member&apos;s total eligible games; off-diagonal cells show shared titles between two members.
          </p>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-slate-400 font-medium">Member</th>
                {analysis.members.map((m) => (
                  <th
                    key={m.memberId}
                    className="p-2 text-center text-slate-300 font-medium min-w-[72px]"
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.members.map((row) => (
                <tr key={row.memberId}>
                  <td className="p-2 font-medium text-white whitespace-nowrap">
                    {row.name}
                  </td>
                  {analysis.members.map((col) => {
                    const count =
                      analysis.overlapMatrix[row.memberId]?.[col.memberId] ?? 0;
                    const isDiag = row.memberId === col.memberId;
                    const intensity = isDiag
                      ? 0
                      : Math.min(1, count / maxOffDiagonal);

                    return (
                      <td key={col.memberId} className="p-1 text-center">
                        <div
                          className={`rounded-md py-2 font-mono font-semibold border ${
                            isDiag
                              ? "bg-slate-800/80 border-slate-700 text-slate-300"
                              : "border-slate-800/80 text-white"
                          }`}
                          style={
                            isDiag
                              ? undefined
                              : {
                                  backgroundColor: `rgba(56, 189, 248, ${
                                    0.08 + intensity * 0.35
                                  })`,
                                }
                          }
                        >
                          {count}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Family Catalog */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Shared Family Catalog ({filteredCatalog.length})
            </h2>
            <p className="text-xs text-slate-400">
              Deduplicated games across all active members, sorted by raw regional price
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games..."
                className="rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {(["all", "exclusive", "shared", "excluded"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === tab
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                    : "bg-slate-800/70 text-slate-400 border border-slate-700/60 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/70 max-h-[520px] overflow-y-auto">
          {filteredCatalog.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No games match your filter.
            </div>
          ) : (
            filteredCatalog.map((entry) => (
              <div
                key={entry.game.appid}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/30"
              >
                <div className="flex items-center gap-3 min-w-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.game.headerImage}
                    alt={entry.game.name}
                    className="h-9 w-20 rounded object-cover border border-slate-800 bg-slate-950"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {entry.game.name}
                      </span>
                      {entry.game.familySharingExcluded && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30">
                          <ShieldAlert className="h-3 w-3" />
                          Excluded
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-medium ${
                          entry.isExclusive ? "text-sky-400" : "text-slate-400"
                        }`}
                      >
                        {entry.isExclusive ? "Exclusive" : `Shared (${entry.ownerNames.length})`}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400">
                        {entry.ownerNames.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="font-mono text-sm font-semibold text-slate-200">
                  {formatMoney(entry.game.rawPrice)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
