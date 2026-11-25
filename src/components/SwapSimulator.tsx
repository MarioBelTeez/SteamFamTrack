"use client";

import { useMemo, useState } from "react";
import { simulateSwap } from "@/lib/analyzer";
import { MemberLibrary, SteamRegion, STEAM_REGIONS } from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

interface SwapSimulatorProps {
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
  includeExcluded: boolean;
}

export function SwapSimulator({
  activeLibraries,
  waitlistLibraries,
  region,
  includeExcluded,
}: SwapSimulatorProps) {
  const [removeId, setRemoveId] = useState<string>(
    activeLibraries[activeLibraries.length - 1]?.member.id ?? ""
  );
  const [addId, setAddId] = useState<string>(
    waitlistLibraries[0]?.member.id ?? ""
  );

  const sym = STEAM_REGIONS[region].symbol;

  const formatMoney = (val: number) => {
    const sign = val > 0 ? "+" : val < 0 ? "-" : "";
    const abs = Math.abs(val);
    if (region === "jp") {
      return `${sign}${sym}${Math.round(abs).toLocaleString()}`;
    }
    return `${sign}${sym}${abs.toFixed(2)}`;
  };

  const formatAbsMoney = (val: number) => {
    const abs = Math.abs(val);
    if (region === "jp") {
      return `${sym}${Math.round(abs).toLocaleString()}`;
    }
    return `${sym}${abs.toFixed(2)}`;
  };

  const libraryStats = useMemo(() => {
    const map = new Map<string, { gamesCount: number; rawValue: number }>();
    for (const lib of [...activeLibraries, ...waitlistLibraries]) {
      const eligible = lib.games.filter(
        (g) => includeExcluded || !g.familySharingExcluded
      );
      const rawValue =
        Math.round(
          eligible.reduce((sum, g) => sum + g.rawPrice, 0) * 100
        ) / 100;
      map.set(lib.member.id, { gamesCount: eligible.length, rawValue });
    }
    return map;
  }, [activeLibraries, waitlistLibraries, includeExcluded]);

  const simulation = useMemo(() => {
    const effectiveRemove =
      activeLibraries.find((l) => l.member.id === removeId)?.member.id ??
      activeLibraries[0]?.member.id;
    const addLib =
      waitlistLibraries.find((l) => l.member.id === addId) ??
      waitlistLibraries[0];
    if (!effectiveRemove || !addLib) return null;
    return simulateSwap(
      activeLibraries,
      effectiveRemove,
      addLib,
      region,
      includeExcluded
    );
  }, [
    activeLibraries,
    waitlistLibraries,
    removeId,
    addId,
    region,
    includeExcluded,
  ]);

  const selectedOutLib = useMemo(
    () =>
      activeLibraries.find(
        (l) => l.member.id === (simulation?.removedMemberId ?? removeId)
      ) ?? activeLibraries[0],
    [activeLibraries, simulation?.removedMemberId, removeId]
  );

  const selectedInLib = useMemo(
    () =>
      waitlistLibraries.find(
        (l) => l.member.id === (simulation?.addedMemberId ?? addId)
      ) ?? waitlistLibraries[0],
    [waitlistLibraries, simulation?.addedMemberId, addId]
  );

  if (waitlistLibraries.length === 0) {
    return (
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <h3 className="font-display text-2xl tracking-wider uppercase text-white">
            No Waitlisted Challengers Yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-bt-muted">
            Add a 7th+ friend to the waitlist via &ldquo;Edit Members&rdquo; to
            simulate Steam Family slot swaps and inspect 1-year cooldown locks.
          </p>
        </div>
      </div>
    );
  }

  const outStats = selectedOutLib
    ? libraryStats.get(selectedOutLib.member.id)
    : undefined;
  const inStats = selectedInLib
    ? libraryStats.get(selectedInLib.member.id)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Side-by-Side OUT vs IN Tactical Selector Deck */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-bt-border pb-4">
            <div className="flex items-center gap-3">
              <span className="tier-rail h-6 w-1 bg-bt-red" />
              <div>
                <h2 className="font-display text-2xl tracking-wider uppercase text-white leading-none">
                  Swap &amp; Cooldown Simulator
                </h2>
                <p className="mt-1 text-xs text-bt-muted">
                  Stage an active slot transfer and preview unique catalog
                  impact before committing a 1-year Steam Family lock.
                </p>
              </div>
            </div>
            <span className="p5-tag bg-bt-elevated border border-bt-border px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-widest text-bt-muted">
              <span className="p5-unskew inline-block">
                REGION // {region.toUpperCase()}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            {/* OUT Selector Card */}
            <div className="p5-frame-sm bg-bt-red/50">
              <div className="bg-bt-elevated p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="p5-tag bg-bt-red px-2.5 py-0.5 font-condensed text-[11px] font-bold uppercase tracking-widest text-white">
                    <span className="p5-unskew inline-block">
                      OUT // ACTIVE MEMBER
                    </span>
                  </span>
                  {selectedOutLib?.member.joinDate && (
                    <span className="font-mono text-[11px] tabular-nums text-bt-muted">
                      JOINED {selectedOutLib.member.joinDate}
                    </span>
                  )}
                </div>

                <label
                  htmlFor="swap-out-select"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  Departing Active Slot
                </label>
                <select
                  id="swap-out-select"
                  value={simulation?.removedMemberId ?? removeId}
                  onChange={(e) => setRemoveId(e.target.value)}
                  className="w-full cursor-pointer border border-bt-border bg-bt-bg px-3 py-2.5 font-mono text-sm text-white focus:border-bt-red focus:outline-none"
                >
                  {activeLibraries.map((lib) => (
                    <option key={lib.member.id} value={lib.member.id}>
                      {lib.member.name} ({lib.games.length} games)
                    </option>
                  ))}
                </select>

                {outStats && (
                  <div className="mt-3 flex items-center justify-between border-t border-bt-border/80 pt-2.5 font-mono text-xs tabular-nums">
                    <span className="text-bt-muted">
                      {outStats.gamesCount} eligible titles
                    </span>
                    <span className="font-semibold text-white">
                      {formatAbsMoney(outStats.rawValue)} raw
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Central Crimson Swap Chevron Badge */}
            <div className="flex justify-center">
              <div
                aria-hidden="true"
                className="p5-frame-sm bg-bt-red shadow-[0_0_24px_rgba(232,0,45,0.4)]"
              >
                <div className="flex h-12 w-12 items-center justify-center bg-bt-red text-white">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* IN Selector Card */}
            <div className="p5-frame-sm bg-emerald-500/45">
              <div className="bg-bt-elevated p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="p5-tag bg-emerald-500 px-2.5 py-0.5 font-condensed text-[11px] font-bold uppercase tracking-widest text-bt-bg">
                    <span className="p5-unskew inline-block">
                      IN // WAITLIST CHALLENGER
                    </span>
                  </span>
                  <span className="font-mono text-[11px] uppercase tabular-nums text-bt-muted">
                    {waitlistLibraries.length} QUEUED
                  </span>
                </div>

                <label
                  htmlFor="swap-in-select"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  Incoming Challenger
                </label>
                <select
                  id="swap-in-select"
                  value={simulation?.addedMemberId ?? addId}
                  onChange={(e) => setAddId(e.target.value)}
                  className="w-full cursor-pointer border border-bt-border bg-bt-bg px-3 py-2.5 font-mono text-sm text-white focus:border-bt-red focus:outline-none"
                >
                  {waitlistLibraries.map((lib) => (
                    <option key={lib.member.id} value={lib.member.id}>
                      {lib.member.name} ({lib.games.length} games)
                    </option>
                  ))}
                </select>

                {inStats && (
                  <div className="mt-3 flex items-center justify-between border-t border-bt-border/80 pt-2.5 font-mono text-xs tabular-nums">
                    <span className="text-bt-muted">
                      {inStats.gamesCount} eligible titles
                    </span>
                    <span className="font-semibold text-white">
                      {formatAbsMoney(inStats.rawValue)} raw
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {simulation && (
        <>
          {/* 1-Year Cooldown Alert Banner */}
          {simulation.removedSlotCooldown.isSlotUnlocked ? (
            <div className="border-y border-r border-emerald-500/30 border-l-4 border-l-emerald-400 bg-emerald-500/10 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                        Slot Unlocked — Immediate Swap Ready
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white">
                      <span className="font-semibold">
                        {simulation.removedMemberName}&apos;s
                      </span>{" "}
                      slot is clear. Joined{" "}
                      <span className="font-mono tabular-nums text-emerald-300">
                        {simulation.removedSlotCooldown.joinDate ??
                          "over 1 year ago"}
                      </span>{" "}
                      —{" "}
                      <span className="font-semibold">
                        {simulation.addedMemberName}
                      </span>{" "}
                      can take this slot immediately.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  0 DAYS LOCKED
                </span>
              </div>
            </div>
          ) : (
            <div className="border-y border-r border-amber-500/35 border-l-4 border-l-bt-red bg-bt-red/10 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-bt-red" />
                      <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                        1-Year Slot Cooldown Active
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white">
                      <span className="font-semibold">
                        {simulation.removedMemberName}
                      </span>{" "}
                      joined on{" "}
                      <span className="font-mono tabular-nums text-amber-200">
                        {simulation.removedSlotCooldown.joinDate}
                      </span>
                      . Leaving now locks this slot until{" "}
                      <span className="font-mono font-bold tabular-nums text-amber-300">
                        {simulation.removedSlotCooldown.slotUnlockDate}
                      </span>{" "}
                      (
                      <span className="font-mono font-semibold tabular-nums text-bt-red">
                        {simulation.removedSlotCooldown.daysUntilUnlock} days
                        remaining
                      </span>
                      ).
                    </p>
                  </div>
                </div>
                <span className="p5-tag bg-bt-red px-3 py-1 font-mono text-xs font-bold uppercase tabular-nums text-white">
                  <span className="p5-unskew inline-block">
                    {simulation.removedSlotCooldown.daysUntilUnlock}D LOCK
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Result KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p5-frame bg-bt-border">
              <div className="bg-bt-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                    Unique Catalog Delta
                  </span>
                  <span className="font-mono text-[11px] uppercase tabular-nums text-bt-muted">
                    {simulation.beforeUniqueGames} →{" "}
                    {simulation.afterUniqueGames}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-3">
                  <span
                    className={`font-display text-4xl sm:text-5xl tracking-wide tabular-nums leading-none ${
                      simulation.uniqueGamesDelta >= 0
                        ? "text-emerald-400"
                        : "text-bt-red"
                    }`}
                  >
                    {simulation.uniqueGamesDelta >= 0 ? "+" : ""}
                    {simulation.uniqueGamesDelta} GAMES
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-bt-border pt-2.5 font-mono text-xs tabular-nums text-bt-muted">
                  <span>{simulation.beforeUniqueGames} before</span>
                  <ArrowRight className="h-3.5 w-3.5 text-bt-red" />
                  <span className="font-semibold text-white">
                    {simulation.afterUniqueGames} unique titles after
                  </span>
                </div>
              </div>
            </div>

            <div className="p5-frame bg-bt-border">
              <div className="bg-bt-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                    Regional Value Delta
                  </span>
                  <span className="font-mono text-[11px] uppercase tabular-nums text-bt-muted">
                    {region.toUpperCase()} RAW PRICE
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-3">
                  <span
                    className={`font-display text-4xl sm:text-5xl tracking-wide tabular-nums leading-none ${
                      simulation.uniqueValueDelta >= 0
                        ? "text-emerald-400"
                        : "text-bt-red"
                    }`}
                  >
                    {formatMoney(simulation.uniqueValueDelta)}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-bt-border pt-2.5 font-mono text-xs tabular-nums text-bt-muted">
                  <span>{formatAbsMoney(simulation.beforeUniqueValue)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-bt-red" />
                  <span className="font-semibold text-white">
                    {formatAbsMoney(simulation.afterUniqueValue)} catalog value
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Before -> After % Share Impact Table */}
          <div className="p5-frame bg-bt-border">
            <div className="bg-bt-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bt-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="tier-rail h-5 w-1 bg-bt-red" />
                  <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                    Contribution % Share Shift
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-bt-muted">
                  <Clock className="h-3.5 w-3.5 text-bt-red" />
                  Live simulation
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-bt-border bg-bt-bg/70 font-condensed text-[11px] font-bold uppercase tracking-[0.18em] text-bt-muted">
                      <th className="px-5 py-2.5">Member</th>
                      <th className="px-4 py-2.5 text-right">Before</th>
                      <th className="px-2 py-2.5 text-center w-8"></th>
                      <th className="px-4 py-2.5 text-right">After</th>
                      <th className="px-5 py-2.5 text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bt-border/60 text-sm">
                    {simulation.shareDeltas.map((d) => {
                      const isRemoved =
                        d.memberId === simulation.removedMemberId;
                      const isAdded = d.memberId === simulation.addedMemberId;
                      return (
                        <tr
                          key={d.memberId}
                          className={`transition-colors hover:bg-bt-elevated/60 ${
                            isRemoved
                              ? "bg-bt-red/5"
                              : isAdded
                              ? "bg-emerald-500/5"
                              : ""
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`font-medium ${
                                  isRemoved
                                    ? "text-bt-muted line-through"
                                    : "text-white"
                                }`}
                              >
                                {d.name}
                              </span>
                              {isRemoved && (
                                <span className="p5-tag bg-bt-red px-2 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-white">
                                  <span className="p5-unskew inline-block">
                                    OUT
                                  </span>
                                </span>
                              )}
                              {isAdded && (
                                <span className="p5-tag bg-emerald-500 px-2 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-bg">
                                  <span className="p5-unskew inline-block">
                                    IN
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-bt-muted">
                            {d.beforePct.toFixed(1)}%
                          </td>
                          <td className="px-2 py-3 text-center text-bt-muted">
                            <ArrowRight className="mx-auto h-3.5 w-3.5 text-bt-red/80" />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-white">
                            {d.afterPct.toFixed(1)}%
                          </td>
                          <td
                            className={`px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums ${
                              d.deltaPct > 0
                                ? "text-emerald-400"
                                : d.deltaPct < 0
                                ? "text-bt-red"
                                : "text-bt-muted"
                            }`}
                          >
                            {d.deltaPct > 0 ? "+" : ""}
                            {d.deltaPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Waitlist Roster Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="tier-rail h-5 w-1 bg-bt-red" />
            <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
              Waitlist Roster ({waitlistLibraries.length})
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-bt-muted">
            <Users className="h-3.5 w-3.5 text-bt-red" />
            Select a challenger to simulate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {waitlistLibraries.map((lib) => {
            const isSelected =
              (simulation?.addedMemberId ?? addId) === lib.member.id;
            const stats = libraryStats.get(lib.member.id) ?? {
              gamesCount: lib.games.length,
              rawValue: 0,
            };

            return (
              <button
                key={lib.member.id}
                type="button"
                onClick={() => setAddId(lib.member.id)}
                className={`p5-frame-sm p5-frame-interactive cursor-pointer text-left transition-colors ${
                  isSelected
                    ? "bg-bt-red"
                    : "bg-bt-border hover:bg-bt-red/60"
                }`}
              >
                <div className="bg-bt-surface p-4 h-full flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-condensed text-base font-bold uppercase tracking-wide text-white">
                        {lib.member.name}
                      </div>
                      <div className="truncate font-mono text-[11px] text-bt-muted">
                        {lib.personaName || lib.steamId64}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="p5-tag shrink-0 bg-bt-red px-2 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-white">
                        <span className="p5-unskew inline-block">STAGED</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-bt-border pt-2.5">
                    <div>
                      <div className="font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                        Games
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-white">
                        {stats.gamesCount}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                        Raw Value
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                        {formatAbsMoney(stats.rawValue)}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
