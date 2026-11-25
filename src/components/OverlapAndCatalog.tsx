"use client";

import { useMemo, useState } from "react";
import { FamilyAnalysis } from "@/lib/types";
import {
  ArrowUpDown,
  ExternalLink,
  Gamepad2,
  Grid3X3,
  LayoutGrid,
  List,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";

interface OverlapAndCatalogProps {
  analysis: FamilyAnalysis;
}

type OwnershipFilter = "all" | "exclusive" | "shared" | "excluded";
type SortOption = "price-desc" | "title-asc" | "shared-desc";
type ViewMode = "grid" | "list";

const PAGE_SIZE = 60;
const HEATMAP_LEGEND_STEPS = [0, 0.14, 0.28, 0.46, 0.65] as const;

interface SteamHeaderArtProps {
  src: string;
  alt: string;
  appid: number;
  variant: "card" | "thumb";
}

function SteamHeaderArt({ src, alt, appid, variant }: SteamHeaderArtProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (variant === "thumb") {
      return (
        <div className="flex h-full w-full items-center justify-center bg-bt-elevated text-bt-dim">
          <Gamepad2 className="h-4 w-4" />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-bt-elevated px-4 text-center">
        <Gamepad2 className="h-7 w-7 text-bt-dim" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-bt-dim">
          NO ART // APP {appid}
        </span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={
        variant === "card"
          ? "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          : "h-full w-full object-cover"
      }
    />
  );
}

export function OverlapAndCatalog({ analysis }: OverlapAndCatalogProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OwnershipFilter>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("price-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [hoveredCell, setHoveredCell] = useState<{
    rowId: string;
    colId: string;
  } | null>(null);

  const sym = analysis.currencySymbol;

  const effectiveMemberFilter = useMemo(() => {
    if (memberFilter === "all") return "all";
    return analysis.members.some((m) => m.memberId === memberFilter)
      ? memberFilter
      : "all";
  }, [analysis.members, memberFilter]);

  const hasExcludedInCatalog = useMemo(
    () => analysis.catalog.some((entry) => entry.game.familySharingExcluded),
    [analysis.catalog]
  );

  const effectiveFilter: OwnershipFilter =
    filter === "excluded" && !hasExcludedInCatalog ? "all" : filter;

  const formatMoney = (val: number, isFree?: boolean) => {
    if (isFree || val === 0) return "FREE";
    if (analysis.region === "jp") {
      return `${sym}${Math.round(val).toLocaleString()}`;
    }
    return `${sym}${val.toFixed(2)}`;
  };

  const formatTotal = (val: number) => {
    if (analysis.region === "jp") {
      return `${sym}${Math.round(val).toLocaleString()}`;
    }
    return `${sym}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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

    const matches = analysis.catalog.filter((entry) => {
      if (q) {
        const matchesName = entry.game.name.toLowerCase().includes(q);
        const matchesAppId = String(entry.game.appid).includes(q);
        if (!matchesName && !matchesAppId) return false;
      }
      if (effectiveFilter === "exclusive" && !entry.isExclusive) return false;
      if (effectiveFilter === "shared" && entry.isExclusive) return false;
      if (effectiveFilter === "excluded" && !entry.game.familySharingExcluded) {
        return false;
      }
      if (
        effectiveMemberFilter !== "all" &&
        !entry.ownerIds.includes(effectiveMemberFilter)
      ) {
        return false;
      }
      return true;
    });

    return matches.sort((a, b) => {
      if (sortBy === "title-asc") {
        return a.game.name.localeCompare(b.game.name);
      }
      if (sortBy === "shared-desc") {
        return (
          b.ownerIds.length - a.ownerIds.length ||
          b.game.rawPrice - a.game.rawPrice ||
          a.game.name.localeCompare(b.game.name)
        );
      }
      return (
        b.game.rawPrice - a.game.rawPrice ||
        a.game.name.localeCompare(b.game.name)
      );
    });
  }, [
    analysis.catalog,
    query,
    effectiveFilter,
    effectiveMemberFilter,
    sortBy,
  ]);

  const filteredTotalValue = useMemo(
    () =>
      filteredCatalog.reduce((acc, entry) => acc + entry.game.rawPrice, 0),
    [filteredCatalog]
  );

  const visibleCatalog = useMemo(
    () => filteredCatalog.slice(0, visibleCount),
    [filteredCatalog, visibleCount]
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    effectiveFilter !== "all" ||
    effectiveMemberFilter !== "all";

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const handleFilterChange = (next: OwnershipFilter) => {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  };

  const handleMemberChange = (nextMemberId: string) => {
    setMemberFilter(nextMemberId);
    setVisibleCount(PAGE_SIZE);
  };

  const handleToggleMemberFilter = (memberId: string) => {
    setMemberFilter((prev) => (prev === memberId ? "all" : memberId));
    setVisibleCount(PAGE_SIZE);
  };

  const handleSortChange = (next: SortOption) => {
    setSortBy(next);
    setVisibleCount(PAGE_SIZE);
  };

  const handleResetFilters = () => {
    setQuery("");
    setFilter("all");
    setMemberFilter("all");
    setVisibleCount(PAGE_SIZE);
  };

  const ownershipTabs: { id: OwnershipFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "exclusive", label: "Exclusive" },
    { id: "shared", label: "Shared" },
    ...(hasExcludedInCatalog
      ? [{ id: "excluded" as const, label: "Opt-Out" }]
      : []),
  ];

  const hoveredSummary = useMemo(() => {
    if (!hoveredCell) return null;
    const row = analysis.members.find((m) => m.memberId === hoveredCell.rowId);
    const col = analysis.members.find((m) => m.memberId === hoveredCell.colId);
    if (!row || !col) return null;
    const count = analysis.overlapMatrix[row.memberId]?.[col.memberId] ?? 0;
    if (row.memberId === col.memberId) {
      return `${row.name.toUpperCase()} // ${count} ELIGIBLE`;
    }
    return `${row.name.toUpperCase()} × ${col.name.toUpperCase()} // ${count} SHARED`;
  }, [analysis.members, analysis.overlapMatrix, hoveredCell]);

  return (
    <div className="space-y-6">
      {/* N x N Overlap Heatmap Matrix */}
      <section className="p5-frame bg-bt-border">
        <div className="bg-bt-surface overflow-hidden">
          <div className="border-b border-bt-border bg-bt-elevated/50 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="h-4 w-1 bg-bt-red" aria-hidden="true" />
                <Grid3X3 className="h-4 w-4 text-bt-red" />
                <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white">
                  Library Overlap Matrix
                </h2>
                <span className="p5-tag inline-flex items-center bg-bt-bg border border-bt-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-bt-muted">
                  <span className="p5-unskew tabular-nums">
                    {analysis.members.length}×{analysis.members.length} TELEMETRY
                  </span>
                </span>
              </div>
              <p className="text-xs text-bt-muted">
                Diagonal cells show each member&apos;s total eligible titles; off-diagonal cells map shared overlap between pairs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {hoveredSummary && (
                <div className="border border-bt-red/40 bg-bt-bg px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider text-white tabular-nums">
                  {hoveredSummary}
                </div>
              )}

              <div
                className="flex items-center gap-2 border border-bt-border bg-bt-bg px-3 py-1.5"
                aria-label="Overlap intensity legend"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                  0
                </span>
                <div className="flex items-center gap-1">
                  {HEATMAP_LEGEND_STEPS.map((alpha) => (
                    <span
                      key={alpha}
                      className="h-3 w-4 border border-bt-border/80"
                      style={{
                        backgroundColor:
                          alpha === 0
                            ? "#181116"
                            : `rgba(232, 0, 45, ${alpha})`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-bt-red font-semibold">
                  HIGH OVERLAP
                </span>
              </div>
            </div>
          </div>

          <div
            className="tier-rail overflow-x-auto p-4 sm:p-5"
            onMouseLeave={() => setHoveredCell(null)}
          >
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-bt-dim">
                    Member
                  </th>
                  {analysis.members.map((col) => {
                    const isColHighlighted = hoveredCell?.colId === col.memberId;
                    const isFilteredMember =
                      effectiveMemberFilter === col.memberId;
                    return (
                      <th
                        key={col.memberId}
                        className="px-2 py-2 text-center min-w-[82px]"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMemberFilter(col.memberId)}
                          title={`Filter catalog by ${col.name}`}
                          className={`w-full cursor-pointer px-1.5 py-1 font-condensed text-sm font-bold uppercase tracking-wider transition-colors ${
                            isFilteredMember
                              ? "bg-bt-red text-white"
                              : isColHighlighted
                                ? "bg-bt-elevated text-white"
                                : "text-bt-muted hover:text-white"
                          }`}
                        >
                          <span className="block truncate">{col.name}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {analysis.members.map((row) => {
                  const isRowHighlighted = hoveredCell?.rowId === row.memberId;
                  const isFilteredMember =
                    effectiveMemberFilter === row.memberId;
                  return (
                    <tr key={row.memberId}>
                      <td className="pr-2 py-0.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberFilter(row.memberId)}
                          title={`Filter catalog by ${row.name}`}
                          className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left font-condensed text-sm font-bold uppercase tracking-wider transition-colors ${
                            isFilteredMember
                              ? "bg-bt-red text-white"
                              : isRowHighlighted
                                ? "bg-bt-elevated text-white"
                                : "text-white hover:bg-bt-elevated/60"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 ${
                              isFilteredMember
                                ? "bg-white"
                                : isRowHighlighted
                                  ? "bg-bt-red"
                                  : "bg-bt-border"
                            }`}
                          />
                          <span>{row.name}</span>
                        </button>
                      </td>
                      {analysis.members.map((col) => {
                        const count =
                          analysis.overlapMatrix[row.memberId]?.[
                            col.memberId
                          ] ?? 0;
                        const isDiag = row.memberId === col.memberId;
                        const isHovered =
                          hoveredCell?.rowId === row.memberId &&
                          hoveredCell?.colId === col.memberId;
                        const isCrosshair =
                          !isHovered &&
                          (hoveredCell?.rowId === row.memberId ||
                            hoveredCell?.colId === col.memberId);
                        const intensity =
                          isDiag || count === 0
                            ? 0
                            : Math.min(1, count / maxOffDiagonal);
                        const crimsonAlpha = 0.08 + intensity * 0.57;

                        return (
                          <td
                            key={col.memberId}
                            className="p-0 text-center"
                            onMouseEnter={() =>
                              setHoveredCell({
                                rowId: row.memberId,
                                colId: col.memberId,
                              })
                            }
                          >
                            <div
                              title={
                                isDiag
                                  ? `${row.name}: ${count} total eligible games`
                                  : `${row.name} & ${col.name}: ${count} shared games`
                              }
                              className={`py-2.5 px-2 font-mono text-xs tabular-nums border transition-colors ${
                                isDiag
                                  ? "bg-bt-elevated border-bt-border border-b-2 border-b-bt-red font-bold text-white"
                                  : count === 0
                                    ? "bg-bt-bg/70 border-bt-border/70 font-medium text-bt-dim"
                                    : "font-semibold text-white"
                              } ${
                                isHovered
                                  ? "ring-1 ring-inset ring-white/80"
                                  : isCrosshair
                                    ? "ring-1 ring-inset ring-bt-red/35"
                                    : ""
                              }`}
                              style={
                                isDiag || count === 0
                                  ? undefined
                                  : {
                                      backgroundColor: `rgba(232, 0, 45, ${crimsonAlpha.toFixed(3)})`,
                                      borderColor: `rgba(232, 0, 45, ${(
                                        0.24 +
                                        intensity * 0.48
                                      ).toFixed(3)})`,
                                    }
                              }
                            >
                              {isDiag ? count : count === 0 ? "—" : count}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Deduplicated Family Game Catalog */}
      <section className="p5-frame bg-bt-border">
        <div className="bg-bt-surface overflow-hidden">
          {/* Header */}
          <div className="border-b border-bt-border bg-bt-elevated/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="h-4 w-1 bg-bt-red" aria-hidden="true" />
                <h2 className="font-condensed text-xl font-bold uppercase tracking-wider text-white">
                  Shared Family Catalog
                </h2>
                <span className="p5-tag inline-flex items-center bg-bt-red px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span className="p5-unskew tabular-nums">
                    {filteredCatalog.length} / {analysis.catalog.length} TITLES
                  </span>
                </span>
              </div>
              <p className="text-xs text-bt-muted">
                Deduplicated library across all active members with raw {analysis.region.toUpperCase()} store valuation.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className="border border-bt-border bg-bt-bg px-3 py-1.5 text-right">
                <div className="font-mono text-[10px] uppercase tracking-widest text-bt-dim">
                  View Value
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums text-white">
                  {formatTotal(filteredTotalValue)}
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Control Toolbar */}
          <div className="border-b border-bt-border bg-bt-elevated/30 px-5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Left group: Search + Ownership segmented buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[210px] sm:flex-initial sm:w-64">
                <Search className="pointer-events-none h-3.5 w-3.5 text-bt-dim absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search title or AppID..."
                  aria-label="Search games by title or AppID"
                  className="w-full bg-bt-bg border border-bt-border pl-8 pr-8 py-1.5 font-mono text-xs text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none transition-colors"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => handleQueryChange("")}
                    aria-label="Clear search"
                    className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-bt-dim hover:text-white transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div
                className="inline-flex border border-bt-border bg-bt-bg p-0.5"
                role="group"
                aria-label="Filter by ownership"
              >
                {ownershipTabs.map((tab) => {
                  const isActive = effectiveFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleFilterChange(tab.id)}
                      className={`cursor-pointer px-3 py-1 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                        isActive
                          ? "bg-bt-red text-white"
                          : "bg-transparent text-bt-muted hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right group: Member filter + Sort + Grid/List toggle */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Member Dropdown */}
              <div className="relative flex items-center">
                <Users className="pointer-events-none h-3.5 w-3.5 text-bt-dim absolute left-2.5" />
                <select
                  value={effectiveMemberFilter}
                  onChange={(e) => handleMemberChange(e.target.value)}
                  aria-label="Filter by member"
                  className="cursor-pointer bg-bt-bg border border-bt-border pl-8 pr-7 py-1.5 font-mono text-xs text-white focus:border-bt-red focus:outline-none transition-colors"
                >
                  <option value="all">All members</option>
                  {analysis.members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name} ({m.totalGames})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <ArrowUpDown className="pointer-events-none h-3.5 w-3.5 text-bt-dim absolute left-2.5" />
                <select
                  value={sortBy}
                  onChange={(e) =>
                    handleSortChange(e.target.value as SortOption)
                  }
                  aria-label="Sort catalog"
                  className="cursor-pointer bg-bt-bg border border-bt-border pl-8 pr-7 py-1.5 font-mono text-xs text-white focus:border-bt-red focus:outline-none transition-colors"
                >
                  <option value="price-desc">Price High→Low</option>
                  <option value="title-asc">Title A→Z</option>
                  <option value="shared-desc">Most Shared</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="cursor-pointer border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bt-muted hover:border-bt-red hover:text-white transition-colors"
                >
                  Reset
                </button>
              )}

              {/* Grid / List View Toggle */}
              <div
                className="inline-flex border border-bt-border bg-bt-bg p-0.5"
                role="group"
                aria-label="Catalog view mode"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Art Grid view"
                  aria-pressed={viewMode === "grid"}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                    viewMode === "grid"
                      ? "bg-bt-red text-white"
                      : "text-bt-muted hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="Compact List view"
                  aria-pressed={viewMode === "list"}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                    viewMode === "list"
                      ? "bg-bt-red text-white"
                      : "text-bt-muted hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Catalog Content */}
          {filteredCatalog.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Gamepad2 className="mx-auto mb-3 h-8 w-8 text-bt-dim" />
              <p className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                No Matching Titles
              </p>
              <p className="mt-1 font-mono text-xs text-bt-muted">
                Adjust your search query, ownership filter, or member selection.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="cursor-pointer mt-4 bg-bt-red px-4 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red/90 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {visibleCatalog.map((entry) => {
                  const isFree = entry.game.isFree || entry.game.rawPrice === 0;
                  return (
                    <article
                      key={entry.game.appid}
                      className="p5-frame-sm p5-frame-interactive bg-bt-border group"
                    >
                      <div className="bg-bt-surface flex flex-col overflow-hidden">
                        {/* Steam Header Art Banner */}
                        <div className="relative aspect-[460/215] w-full overflow-hidden bg-bt-bg border-b border-bt-border">
                          <SteamHeaderArt
                            key={entry.game.headerImage}
                            src={entry.game.headerImage}
                            alt={entry.game.name}
                            appid={entry.game.appid}
                            variant="card"
                          />

                          {/* Subtle Scrim for Overlay Legibility */}
                          <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bt-bg/90 via-transparent to-bt-bg/45"
                            aria-hidden="true"
                          />

                          {/* Top-Left Skewed Tags */}
                          <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
                            {entry.isExclusive ? (
                              <span className="p5-tag inline-flex items-center bg-bt-red px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                                <span className="p5-unskew">EXCLUSIVE</span>
                              </span>
                            ) : (
                              <span className="p5-tag inline-flex items-center bg-bt-bg/90 border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-xs">
                                <span className="p5-unskew tabular-nums">
                                  SHARED ×{entry.ownerNames.length}
                                </span>
                              </span>
                            )}

                            {entry.game.familySharingExcluded && (
                              <span className="p5-tag inline-flex items-center bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-xs">
                                <span className="p5-unskew inline-flex items-center gap-1">
                                  <ShieldAlert className="h-2.5 w-2.5" />
                                  OPT-OUT
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Bottom-Right Price Tag */}
                          <div
                            className={`absolute bottom-2 right-2 bg-bt-bg/95 border border-bt-border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                              isFree ? "text-bt-muted" : "text-white"
                            }`}
                          >
                            {formatMoney(entry.game.rawPrice, entry.game.isFree)}
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
                          <div>
                            <h3
                              title={entry.game.name}
                              className="font-condensed text-lg font-bold leading-snug tracking-wide text-white line-clamp-1"
                            >
                              {entry.game.name}
                            </h3>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] tabular-nums text-bt-dim">
                                APPID {entry.game.appid}
                              </span>
                              <a
                                href={`https://store.steampowered.com/app/${entry.game.appid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Open ${entry.game.name} on Steam`}
                                className="cursor-pointer inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-bt-dim hover:text-bt-red transition-colors"
                              >
                                <span>Store</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {entry.ownerIds.map((ownerId, idx) => {
                              const ownerName =
                                entry.ownerNames[idx] ?? ownerId;
                              const isSelectedOwner =
                                effectiveMemberFilter === ownerId;
                              return (
                                <button
                                  key={ownerId}
                                  type="button"
                                  onClick={() =>
                                    handleToggleMemberFilter(ownerId)
                                  }
                                  title={`Filter by ${ownerName}`}
                                  className={`cursor-pointer border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                    isSelectedOwner
                                      ? "border-bt-red bg-bt-red/20 text-white"
                                      : "border-bt-border bg-bt-bg text-bt-muted hover:border-bt-red/60 hover:text-white"
                                  }`}
                                >
                                  {ownerName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Compact High-Density List View */
            <div className="tier-rail overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-bt-border bg-bt-bg/90 font-mono text-[10px] uppercase tracking-widest text-bt-dim">
                    <th className="px-5 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Owners</th>
                    <th className="px-5 py-2.5 text-right">Raw Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bt-border/60">
                  {visibleCatalog.map((entry) => {
                    const isFree = entry.game.isFree || entry.game.rawPrice === 0;
                    return (
                      <tr
                        key={entry.game.appid}
                        className="hover:bg-bt-elevated/70 transition-colors"
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3 min-w-[240px]">
                            <div className="h-[36px] w-[76px] shrink-0 overflow-hidden border border-bt-border bg-bt-bg">
                              <SteamHeaderArt
                                key={entry.game.headerImage}
                                src={entry.game.headerImage}
                                alt={entry.game.name}
                                appid={entry.game.appid}
                                variant="thumb"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`https://store.steampowered.com/app/${entry.game.appid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer font-condensed text-base font-bold tracking-wide text-white hover:text-bt-red transition-colors truncate"
                                >
                                  {entry.game.name}
                                </a>
                                {entry.game.familySharingExcluded && (
                                  <span className="inline-flex shrink-0 items-center gap-1 border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                    <ShieldAlert className="h-2.5 w-2.5" />
                                    OPT-OUT
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] tabular-nums text-bt-dim">
                                APPID {entry.game.appid}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {entry.isExclusive ? (
                            <span className="p5-tag inline-flex items-center bg-bt-red px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                              <span className="p5-unskew">EXCLUSIVE</span>
                            </span>
                          ) : (
                            <span className="p5-tag inline-flex items-center bg-bt-bg border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                              <span className="p5-unskew tabular-nums">
                                SHARED ×{entry.ownerNames.length}
                              </span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {entry.ownerIds.map((ownerId, idx) => {
                              const ownerName =
                                entry.ownerNames[idx] ?? ownerId;
                              const isSelectedOwner =
                                effectiveMemberFilter === ownerId;
                              return (
                                <button
                                  key={ownerId}
                                  type="button"
                                  onClick={() =>
                                    handleToggleMemberFilter(ownerId)
                                  }
                                  className={`cursor-pointer border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                    isSelectedOwner
                                      ? "border-bt-red bg-bt-red/20 text-white"
                                      : "border-bt-border bg-bt-bg text-bt-muted hover:border-bt-red/60 hover:text-white"
                                  }`}
                                >
                                  {ownerName}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        <td
                          className={`px-5 py-2.5 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                            isFree ? "text-bt-dim" : "text-white"
                          }`}
                        >
                          {formatMoney(entry.game.rawPrice, entry.game.isFree)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer for Large Libraries */}
          {filteredCatalog.length > visibleCount && (
            <div className="border-t border-bt-border bg-bt-elevated/40 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-bt-muted tabular-nums">
                Showing {visibleCatalog.length} of {filteredCatalog.length} titles
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="cursor-pointer bg-bt-red px-3.5 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red/90 transition-colors"
                >
                  Load +{Math.min(PAGE_SIZE, filteredCatalog.length - visibleCount)} More
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredCatalog.length)}
                  className="cursor-pointer border border-bt-border bg-bt-bg px-3.5 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted hover:border-bt-red hover:text-white transition-colors"
                >
                  Show All ({filteredCatalog.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
