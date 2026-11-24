"use client";

import { useMemo, useState } from "react";
import { simulateSwap } from "@/lib/analyzer";
import { MemberLibrary, SteamRegion, STEAM_REGIONS } from "@/lib/types";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock } from "lucide-react";

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
    if (region === "jp") return `${sign}${sym}${Math.round(abs).toLocaleString()}`;
    return `${sign}${sym}${abs.toFixed(2)}`;
  };

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
  }, [activeLibraries, waitlistLibraries, removeId, addId, region, includeExcluded]);

  if (waitlistLibraries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <ArrowRightLeft className="h-8 w-8 text-slate-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">No Waitlisted Friends Yet</h3>
        <p className="mt-1 text-sm text-slate-400">
          Add a 7th+ friend to the waitlist via &ldquo;Edit Members&rdquo; to simulate Steam Family slot swaps and check 1-year cooldowns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="h-4 w-4 text-sky-400" />
          <h2 className="text-base font-semibold text-white">
            Swap &amp; Cooldown Simulator
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Swap Out (Active Slot)
            </label>
            <select
              value={simulation?.removedMemberId ?? removeId}
              onChange={(e) => setRemoveId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {activeLibraries.map((lib) => (
                <option key={lib.member.id} value={lib.member.id}>
                  {lib.member.name} ({lib.games.length} games)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Swap In (Waitlist)
            </label>
            <select
              value={simulation?.addedMemberId ?? addId}
              onChange={(e) => setAddId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {waitlistLibraries.map((lib) => (
                <option key={lib.member.id} value={lib.member.id}>
                  {lib.member.name} ({lib.games.length} games)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {simulation && (
        <>
          {/* Cooldown Banner */}
          {simulation.removedSlotCooldown.isSlotUnlocked ? (
            <div className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 flex items-center gap-3 text-sm text-lime-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-semibold">
                  {simulation.removedMemberName}&apos;s slot is unlocked.
                </span>{" "}
                Joined {simulation.removedSlotCooldown.joinDate ?? "over 1 year ago"} — a new member can take this slot immediately.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3 text-sm text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold">
                  1-Year Slot Cooldown Active:
                </span>{" "}
                {simulation.removedMemberName} joined on{" "}
                <span className="font-mono">{simulation.removedSlotCooldown.joinDate}</span>.
                Leaving now locks this slot until{" "}
                <span className="font-mono font-semibold">
                  {simulation.removedSlotCooldown.slotUnlockDate}
                </span>{" "}
                ({simulation.removedSlotCooldown.daysUntilUnlock} days remaining).
              </div>
            </div>
          )}

          {/* Impact Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Unique Catalog Size Impact
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-white">
                  {simulation.beforeUniqueGames} → {simulation.afterUniqueGames}
                </span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    simulation.uniqueGamesDelta >= 0
                      ? "text-lime-400"
                      : "text-rose-400"
                  }`}
                >
                  ({simulation.uniqueGamesDelta >= 0 ? "+" : ""}
                  {simulation.uniqueGamesDelta} games)
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Unique Catalog Value Impact
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-white font-mono">
                  {sym}{simulation.afterUniqueValue.toFixed(2)}
                </span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    simulation.uniqueValueDelta >= 0
                      ? "text-lime-400"
                      : "text-rose-400"
                  }`}
                >
                  ({formatMoney(simulation.uniqueValueDelta)})
                </span>
              </div>
            </div>
          </div>

          {/* Share Shift Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Contribution % Share Shift
              </h3>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Live preview
              </span>
            </div>
            <div className="divide-y divide-slate-800/70">
              {simulation.shareDeltas.map((d) => (
                <div
                  key={d.memberId}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="font-medium text-white">{d.name}</span>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-slate-400">{d.beforePct.toFixed(1)}%</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-white font-semibold">
                      {d.afterPct.toFixed(1)}%
                    </span>
                    <span
                      className={`w-16 text-right text-xs ${
                        d.deltaPct > 0
                          ? "text-lime-400"
                          : d.deltaPct < 0
                          ? "text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {d.deltaPct > 0 ? "+" : ""}
                      {d.deltaPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
