"use client";

import { useMemo, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import {
  computeSlotCooldown,
  simulateRosterChange,
  simulateSwap,
  splitIntoTwoFamilies,
} from "@/lib/analyzer";
import {
  MemberLibrary,
  SteamRegion,
  STEAM_REGIONS,
  TwoFamilySplitMode,
} from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  GripVertical,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

interface SwapSimulatorProps {
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
  includeExcluded: boolean;
}

type RosterSide = "active" | "waitlist";
type SimulatorTab = "multi-swap" | "two-family";

interface DragPayload {
  side: RosterSide;
  id: string;
}

export function SwapSimulator({
  activeLibraries,
  waitlistLibraries,
  region,
  includeExcluded,
}: SwapSimulatorProps) {
  const [simMode, setSimMode] = useState<SimulatorTab>("multi-swap");
  const [splitMode, setSplitMode] = useState<TwoFamilySplitMode>("equal-games");
  const [customActiveIds, setCustomActiveIds] = useState<string[] | null>(null);
  const [dragSource, setDragSource] = useState<DragPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragPayload | null>(
    null
  );

  const sym = STEAM_REGIONS[region].symbol;

  const allPool = useMemo(
    () => [...activeLibraries, ...waitlistLibraries],
    [activeLibraries, waitlistLibraries]
  );

  const libraryById = useMemo(() => {
    const map = new Map<string, MemberLibrary>();
    for (const lib of allPool) {
      map.set(lib.member.id, lib);
    }
    return map;
  }, [allPool]);

  const originalActiveIdSet = useMemo(
    () => new Set(activeLibraries.map((l) => l.member.id)),
    [activeLibraries]
  );

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
    for (const lib of allPool) {
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
  }, [allPool, includeExcluded]);

  const cooldownByMemberId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeSlotCooldown>>();
    for (const lib of activeLibraries) {
      map.set(lib.member.id, computeSlotCooldown(lib.member.joinDate));
    }
    return map;
  }, [activeLibraries]);

  const bestDefaultPair = useMemo(() => {
    let best: {
      removeId: string;
      addId: string;
      uniqueValueDelta: number;
      uniqueGamesDelta: number;
    } | null = null;

    for (const activeLib of activeLibraries) {
      for (const waitlistLib of waitlistLibraries) {
        const result = simulateSwap(
          activeLibraries,
          activeLib.member.id,
          waitlistLib,
          region,
          includeExcluded
        );
        if (!result) continue;

        if (
          !best ||
          result.uniqueValueDelta > best.uniqueValueDelta ||
          (result.uniqueValueDelta === best.uniqueValueDelta &&
            result.uniqueGamesDelta > best.uniqueGamesDelta)
        ) {
          best = {
            removeId: activeLib.member.id,
            addId: waitlistLib.member.id,
            uniqueValueDelta: result.uniqueValueDelta,
            uniqueGamesDelta: result.uniqueGamesDelta,
          };
        }
      }
    }

    return best;
  }, [activeLibraries, waitlistLibraries, region, includeExcluded]);

  // Resolve current simulated active IDs (defaults to best 1-for-1 swap when waitlist exists).
  const resolvedSimActiveIds = useMemo(() => {
    if (customActiveIds !== null) {
      const valid = customActiveIds.filter((id) => libraryById.has(id));
      if (valid.length > 0 || customActiveIds.length === 0) {
        return valid.slice(0, 6);
      }
    }

    const base = activeLibraries.slice(0, 6).map((l) => l.member.id);
    if (bestDefaultPair) {
      return base.map((id) =>
        id === bestDefaultPair.removeId ? bestDefaultPair.addId : id
      );
    }
    return base;
  }, [customActiveIds, libraryById, activeLibraries, bestDefaultPair]);

  const simActiveIdSet = useMemo(
    () => new Set(resolvedSimActiveIds),
    [resolvedSimActiveIds]
  );

  const displayedActive = useMemo(
    () =>
      resolvedSimActiveIds
        .map((id) => libraryById.get(id))
        .filter((l): l is MemberLibrary => Boolean(l)),
    [resolvedSimActiveIds, libraryById]
  );

  const displayedWaitlist = useMemo(
    () => allPool.filter((l) => !simActiveIdSet.has(l.member.id)).slice(0, 6),
    [allPool, simActiveIdSet]
  );

  const simulation = useMemo(
    () =>
      simulateRosterChange(
        activeLibraries,
        displayedActive,
        region,
        includeExcluded
      ),
    [activeLibraries, displayedActive, region, includeExcluded]
  );

  const twoFamilySplit = useMemo(
    () =>
      simMode === "two-family"
        ? splitIntoTwoFamilies(allPool, splitMode, includeExcluded)
        : null,
    [simMode, allPool, splitMode, includeExcluded]
  );

  const removedIdSet = useMemo(
    () => new Set(simulation.removedMembers.map((m) => m.memberId)),
    [simulation.removedMembers]
  );
  const addedIdSet = useMemo(
    () => new Set(simulation.addedMembers.map((m) => m.memberId)),
    [simulation.addedMembers]
  );

  const lockedRemovedMembers = useMemo(
    () => simulation.removedMembers.filter((m) => !m.cooldown.isSlotUnlocked),
    [simulation.removedMembers]
  );

  if (allPool.length < 2) {
    return (
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <h3 className="font-display text-2xl tracking-wider uppercase text-white">
            Need At Least 2 Members To Simulate
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-bt-muted">
            Add friends to your family or waitlist via &ldquo;Edit Members&rdquo;
            to simulate multi-member swaps or split into 2 balanced families.
          </p>
        </div>
      </div>
    );
  }

  const moveMemberToSide = (
    memberId: string,
    targetSide: RosterSide,
    swapWithTargetId?: string
  ) => {
    const current = [...resolvedSimActiveIds];
    if (targetSide === "active") {
      if (current.includes(memberId)) return;
      if (swapWithTargetId && current.includes(swapWithTargetId)) {
        setCustomActiveIds(
          current.map((id) => (id === swapWithTargetId ? memberId : id))
        );
      } else if (current.length < 6) {
        setCustomActiveIds([...current, memberId]);
      } else {
        // Full 6/6 and dropped on generic active zone -> replace last slot
        setCustomActiveIds([...current.slice(0, 5), memberId]);
      }
    } else {
      if (!current.includes(memberId)) return;
      const next = current.filter((id) => id !== memberId);
      if (swapWithTargetId && !next.includes(swapWithTargetId) && next.length < 6) {
        next.push(swapWithTargetId);
      }
      setCustomActiveIds(next);
    }
  };

  const handleDragStart = (
    side: RosterSide,
    id: string,
    e: DragEvent<HTMLDivElement>
  ) => {
    const payload: DragPayload = { side, id };
    setDragSource(payload);
    setDragOverTarget(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
  };

  const handleDragOver = (
    targetSide: RosterSide,
    targetId: string,
    e: DragEvent<HTMLDivElement>
  ) => {
    if (!dragSource || dragSource.side === targetSide) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (
      dragOverTarget?.side !== targetSide ||
      dragOverTarget?.id !== targetId
    ) {
      setDragOverTarget({ side: targetSide, id: targetId });
    }
  };

  const handleDragLeave = (
    targetSide: RosterSide,
    targetId: string,
    e: DragEvent<HTMLDivElement>
  ) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      if (
        dragOverTarget?.side === targetSide &&
        dragOverTarget?.id === targetId
      ) {
        setDragOverTarget(null);
      }
    }
  };

  const handleDrop = (
    targetSide: RosterSide,
    targetId: string,
    e: DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    let source = dragSource;
    if (!source) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) source = JSON.parse(raw) as DragPayload;
      } catch {
        source = null;
      }
    }

    if (source && source.side !== targetSide) {
      const isEmptyTarget = targetId.startsWith("__empty__");
      moveMemberToSide(
        source.id,
        targetSide,
        isEmptyTarget ? undefined : targetId
      );
    }

    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOverTarget(null);
  };

  const handleCardSelect = (side: RosterSide, id: string) => {
    moveMemberToSide(id, side === "active" ? "waitlist" : "active");
  };

  const handleCardKeyDown = (
    side: RosterSide,
    id: string,
    e: KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardSelect(side, id);
    }
  };

  const renderRosterColumn = (
    side: RosterSide,
    libs: MemberLibrary[],
    heading: string,
    emptyLabel: string
  ) => {
    const isActiveSide = side === "active";

    return (
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-4 sm:p-5 space-y-3.5 h-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bt-border pb-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`tier-rail h-5 w-1 ${
                  isActiveSide ? "bg-bt-red" : "bg-emerald-500"
                }`}
              />
              <h3 className="font-display text-xl tracking-wider uppercase text-white leading-none">
                {heading}
              </h3>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-bt-muted">
              Drag multiple or click to move
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, idx) => {
              const slotNumber = String(idx + 1).padStart(2, "0");
              const lib = libs[idx];
              const emptyTargetId = `__empty__${side}-${slotNumber}`;

              if (!lib) {
                const isEmptyHovered =
                  dragOverTarget?.side === side &&
                  dragOverTarget?.id === emptyTargetId;
                return (
                  <div
                    key={emptyTargetId}
                    onDragOver={(e) => handleDragOver(side, emptyTargetId, e)}
                    onDragLeave={(e) => handleDragLeave(side, emptyTargetId, e)}
                    onDrop={(e) => handleDrop(side, emptyTargetId, e)}
                    className={`border border-dashed p-3.5 flex flex-col justify-between min-h-[126px] transition-colors ${
                      isEmptyHovered
                        ? isActiveSide
                          ? "border-bt-red bg-bt-red/15"
                          : "border-emerald-400 bg-emerald-500/15"
                        : "border-bt-border/80 bg-bt-bg/60"
                    }`}
                  >
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-bt-dim tabular-nums">
                      SLOT {slotNumber}
                    </span>
                    <span className="font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted">
                      {isEmptyHovered ? "DROP TO MOVE HERE" : emptyLabel}
                    </span>
                  </div>
                );
              }

              const memberId = lib.member.id;
              const isNewlyAdded =
                isActiveSide && !originalActiveIdSet.has(memberId);
              const isNewlyRemoved =
                !isActiveSide && originalActiveIdSet.has(memberId);
              const isDragging =
                dragSource?.side === side && dragSource?.id === memberId;
              const isValidDrop =
                dragSource !== null && dragSource.side !== side;
              const isDropHovered =
                dragOverTarget?.side === side &&
                dragOverTarget?.id === memberId;

              const stats = libraryStats.get(memberId) ?? {
                gamesCount: lib.games.length,
                rawValue: 0,
              };
              const cooldown = cooldownByMemberId.get(memberId);
              const initials = (lib.member.name || lib.personaName || "??")
                .slice(0, 2)
                .toUpperCase();

              const frameClass = isDropHovered
                ? isActiveSide
                  ? "bg-bt-red ring-2 ring-white/80"
                  : "bg-emerald-400 ring-2 ring-white/80"
                : isNewlyAdded
                ? "bg-emerald-500"
                : isNewlyRemoved
                ? "bg-bt-red"
                : isValidDrop
                ? isActiveSide
                  ? "bg-bt-red/70"
                  : "bg-emerald-500/70"
                : isActiveSide
                ? "bg-bt-border hover:bg-bt-red/60"
                : "bg-bt-border hover:bg-emerald-500/60";

              return (
                <div
                  key={memberId}
                  role="button"
                  tabIndex={0}
                  draggable
                  onClick={() => handleCardSelect(side, memberId)}
                  onKeyDown={(e) => handleCardKeyDown(side, memberId, e)}
                  onDragStart={(e) => handleDragStart(side, memberId, e)}
                  onDragOver={(e) => handleDragOver(side, memberId, e)}
                  onDragLeave={(e) => handleDragLeave(side, memberId, e)}
                  onDrop={(e) => handleDrop(side, memberId, e)}
                  onDragEnd={handleDragEnd}
                  className={`p5-frame cursor-grab active:cursor-grabbing transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${frameClass} ${
                    isDragging ? "opacity-45 scale-[0.98]" : ""
                  }`}
                >
                  <div className="bg-bt-bg p-3.5 h-full flex flex-col justify-between gap-3 min-h-[126px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-bt-dim tabular-nums">
                        <GripVertical className="h-3 w-3 text-bt-dim" />
                        {slotNumber}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {cooldown && !cooldown.isSlotUnlocked && (
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400 tabular-nums">
                            {cooldown.daysUntilUnlock}D LOCK
                          </span>
                        )}
                        {isNewlyAdded && (
                          <span className="p5-tag bg-emerald-500 px-1.5 py-0.5 font-condensed text-[9px] font-bold uppercase tracking-widest text-bt-bg">
                            <span className="p5-unskew inline-block">IN</span>
                          </span>
                        )}
                        {isNewlyRemoved && (
                          <span className="p5-tag bg-bt-red px-1.5 py-0.5 font-condensed text-[9px] font-bold uppercase tracking-widest text-white">
                            <span className="p5-unskew inline-block">OUT</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0">
                      {lib.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lib.avatarUrl}
                          alt={lib.member.name}
                          width={34}
                          height={34}
                          className={`h-8 w-8 shrink-0 object-cover border ${
                            isNewlyAdded
                              ? "border-emerald-400"
                              : isNewlyRemoved
                              ? "border-bt-red"
                              : "border-bt-border"
                          }`}
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-bt-border bg-bt-surface font-mono text-xs font-bold text-bt-muted">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-condensed text-sm font-bold uppercase tracking-wider text-white truncate">
                          {lib.member.name}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-bt-muted">
                          {stats.gamesCount} games
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-bt-border/80 pt-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                        RAW
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums text-emerald-400">
                        {formatAbsMoney(stats.rawValue)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher: Multi-Swap Simulator vs. 2-Family Fair Splitter */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSimMode("multi-swap")}
              className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 font-condensed text-xs font-bold uppercase tracking-wider border transition-colors ${
                simMode === "multi-swap"
                  ? "bg-bt-red border-bt-red text-white"
                  : "bg-bt-bg border-bt-border text-bt-muted hover:text-white hover:border-bt-red/60"
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Multi-Swap Simulator
            </button>
            <button
              type="button"
              onClick={() => setSimMode("two-family")}
              className={`cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 font-condensed text-xs font-bold uppercase tracking-wider border transition-colors ${
                simMode === "two-family"
                  ? "bg-bt-red border-bt-red text-white"
                  : "bg-bt-bg border-bt-border text-bt-muted hover:text-white hover:border-bt-red/60"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              2-Family Fair Splitter ({Math.min(12, allPool.length)} Members)
            </button>
          </div>

          {simMode === "multi-swap" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-bt-muted">
                STAGED:{" "}
                <span className="text-bt-red font-semibold">
                  {simulation.removedMembers.length} OUT
                </span>{" "}
                ·{" "}
                <span className="text-emerald-400 font-semibold">
                  {simulation.addedMembers.length} IN
                </span>
              </span>
              {bestDefaultPair && (
                <button
                  type="button"
                  onClick={() => setCustomActiveIds(null)}
                  className="cursor-pointer inline-flex items-center gap-1.5 border border-bt-border bg-bt-bg hover:border-emerald-500/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-bt-muted hover:text-white transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  Best 1-for-1
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setCustomActiveIds(
                    activeLibraries.slice(0, 6).map((l) => l.member.id)
                  )
                }
                className="cursor-pointer inline-flex items-center gap-1.5 border border-bt-border bg-bt-bg hover:border-bt-red/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-bt-muted hover:text-white transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "equal-games", label: "Equal Games" },
                  { id: "equal-value", label: "Equal Value" },
                  { id: "stacked-main", label: "Stacked Main + B-Team" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSplitMode(opt.id)}
                  className={`cursor-pointer px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
                    splitMode === opt.id
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold"
                      : "bg-bt-bg border-bt-border text-bt-muted hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {simMode === "two-family" && twoFamilySplit ? (
        <div className="space-y-5">
          {/* Split Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p5-frame bg-bt-border">
              <div className="bg-bt-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                  SPLIT OBJECTIVE
                </div>
                <div className="mt-1.5 font-display text-2xl tracking-wider uppercase text-white">
                  {splitMode === "equal-games"
                    ? "BALANCED UNIQUE GAMES"
                    : splitMode === "equal-value"
                    ? "BALANCED CATALOG VALUE"
                    : "STACKED MAIN + B-TEAM"}
                </div>
              </div>
            </div>
            <div className="p5-frame bg-bt-border">
              <div className="bg-bt-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                  GAMES GAP (A VS B)
                </div>
                <div className="mt-1.5 font-display text-2xl tracking-wider uppercase text-emerald-400 tabular-nums">
                  {twoFamilySplit.gamesGap} GAMES
                </div>
              </div>
            </div>
            <div className="p5-frame bg-bt-border">
              <div className="bg-bt-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                  VALUE GAP (A VS B)
                </div>
                <div className="mt-1.5 font-display text-2xl tracking-wider uppercase text-amber-300 tabular-nums">
                  {formatAbsMoney(twoFamilySplit.valueGap)}
                </div>
              </div>
            </div>
          </div>

          {/* Family A & Family B Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {(
              [
                {
                  title: "FAMILY A",
                  accent: "bg-bt-red",
                  group: twoFamilySplit.familyA,
                },
                {
                  title: "FAMILY B",
                  accent: "bg-emerald-500",
                  group: twoFamilySplit.familyB,
                },
              ] as const
            ).map(({ title, accent, group }) => (
              <div key={title} className="p5-frame bg-bt-border">
                <div className="bg-bt-surface p-5 space-y-4 h-full">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bt-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`tier-rail h-6 w-1 ${accent}`} />
                      <div>
                        <h3 className="font-display text-2xl tracking-wider uppercase text-white leading-none">
                          {title} · {group.members.length} / 6
                        </h3>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-bt-muted tabular-nums">
                          {group.uniqueGamesCount} unique games ·{" "}
                          <span className="text-emerald-400 font-semibold">
                            {formatAbsMoney(group.uniqueCatalogValue)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <Users className="h-4 w-4 text-bt-dim" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.members.map((lib) => {
                      const stats = libraryStats.get(lib.member.id) ?? {
                        gamesCount: lib.games.length,
                        rawValue: 0,
                      };
                      const initials = (
                        lib.member.name ||
                        lib.personaName ||
                        "??"
                      )
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <div
                          key={lib.member.id}
                          className="border border-bt-border bg-bt-bg p-3 flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {lib.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={lib.avatarUrl}
                                alt={lib.member.name}
                                width={32}
                                height={32}
                                className="h-8 w-8 shrink-0 object-cover border border-bt-border"
                              />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-bt-border bg-bt-surface font-mono text-xs font-bold text-bt-muted">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-condensed text-sm font-bold uppercase tracking-wider text-white truncate">
                                {lib.member.name}
                              </div>
                              <div className="font-mono text-[10px] text-bt-muted tabular-nums">
                                {stats.gamesCount} games
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold tabular-nums text-emerald-400 shrink-0">
                            {formatAbsMoney(stats.rawValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Cooldown Alert Banner */}
          {lockedRemovedMembers.length === 0 ? (
            <div className="border-y border-r border-emerald-500/35 border-l-4 border-l-emerald-400 bg-emerald-500/10 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                      {simulation.removedMembers.length === 0
                        ? "No Active Members Removed"
                        : "Staged Slots Ready For Swap"}
                    </div>
                    <p className="mt-0.5 text-sm text-white">
                      {simulation.removedMembers.length === 0
                        ? "Drag or click cards below to stage one or multiple swaps."
                        : "Every removed member has cleared the 1-year cooldown."}
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
                        1-Year Slot Cooldown Active ({lockedRemovedMembers.length}{" "}
                        {lockedRemovedMembers.length === 1 ? "Slot" : "Slots"})
                      </span>
                    </div>
                    <div className="mt-1 space-y-1 text-sm text-white">
                      {lockedRemovedMembers.map((m) => (
                        <p key={m.memberId}>
                          <span className="font-semibold">{m.name}</span>{" "}
                          (joined{" "}
                          <span className="font-mono tabular-nums text-amber-200">
                            {m.cooldown.joinDate}
                          </span>
                          ) locks slot until{" "}
                          <span className="font-mono font-bold tabular-nums text-amber-300">
                            {m.cooldown.slotUnlockDate}
                          </span>{" "}
                          (
                          <span className="font-mono font-semibold tabular-nums text-bt-red">
                            {m.cooldown.daysUntilUnlock}d remaining
                          </span>
                          ).
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="p5-tag bg-bt-red px-3 py-1 font-mono text-xs font-bold uppercase tabular-nums text-white">
                  <span className="p5-unskew inline-block">
                    {Math.max(
                      ...lockedRemovedMembers.map(
                        (m) => m.cooldown.daysUntilUnlock ?? 0
                      )
                    )}
                    D MAX LOCK
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
                    Unique Catalog Net Change (Delta)
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
                    Regional Value Net Change (Delta)
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
                  Live multi-swap simulation
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
                      <th className="px-5 py-2.5 text-right">
                        Net Change (Delta)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bt-border/60 text-sm">
                    {simulation.shareDeltas.map((d) => {
                      const isRemoved = removedIdSet.has(d.memberId);
                      const isAdded = addedIdSet.has(d.memberId);
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

          {/* Side-by-Side IN THE FAMILY (Left) & WAITLIST (Right) Drag-and-Drop Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {renderRosterColumn(
              "active",
              displayedActive,
              `IN THE FAMILY · ${displayedActive.length} / 6`,
              "OPEN FAMILY SLOT"
            )}
            {renderRosterColumn(
              "waitlist",
              displayedWaitlist,
              `WAITLIST · ${displayedWaitlist.length} / 6`,
              "OPEN WAITLIST"
            )}
          </div>
        </>
      )}
    </div>
  );
}
