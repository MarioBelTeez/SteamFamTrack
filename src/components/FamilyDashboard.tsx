"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ContributionBoard } from "@/components/ContributionBoard";
import {
  FamilyLaunchpad,
  type RecentFamilyEntry,
} from "@/components/FamilyLaunchpad";
import { MemberEditorModal } from "@/components/MemberEditorModal";
import { MonthlyHistory } from "@/components/MonthlyHistory";
import { OverlapAndCatalog } from "@/components/OverlapAndCatalog";
import { SaveFamilyModal } from "@/components/SaveFamilyModal";
import { SwapSimulator } from "@/components/SwapSimulator";
import {
  FamilyAnalysis,
  FamilyMemberInput,
  MemberLibrary,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
  SavedFamilyData,
  SteamRegion,
} from "@/lib/types";
import {
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Calendar,
  Check,
  ChevronRight,
  Grid3X3,
  Link2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Share2,
  Users,
} from "lucide-react";

type TabId = "board" | "overlap" | "simulator" | "history";

interface NavItem {
  id: TabId;
  index: string;
  label: string;
  sectionTitle: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "board",
    index: "01",
    label: "Contribution Board",
    sectionTitle: "CONTRIBUTION BOARD",
    icon: BarChart3,
  },
  {
    id: "overlap",
    index: "02",
    label: "Overlap & Catalog",
    sectionTitle: "OVERLAP & CATALOG",
    icon: Grid3X3,
  },
  {
    id: "simulator",
    index: "03",
    label: "Waitlist & Swap Simulator",
    sectionTitle: "WAITLIST & SWAP SIMULATOR",
    icon: ArrowRightLeft,
  },
  {
    id: "history",
    index: "04",
    label: "Monthly Deltas",
    sectionTitle: "MONTHLY DELTAS",
    icon: Calendar,
  },
];

interface MemberWarning {
  memberId: string;
  memberName: string;
  steamInput: string;
  reason: string;
}

interface AnalyzeResponse {
  mode?: "live" | string;
  analysis: FamilyAnalysis;
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  warnings?: MemberWarning[];
  error?: string;
}

interface FamilyDashboardProps {
  initialFamily?: SavedFamilyData;
  initialHasApiKey?: boolean;
  initialHasDatabase?: boolean;
}

const RECENT_FAMILIES_STORAGE_KEY = "sft_recent_families";
const MAX_RECENT_FAMILIES = 5;

function readRecentFamilies(): RecentFamilyEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FAMILIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentFamilyEntry =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as RecentFamilyEntry).slug === "string" &&
          (item as RecentFamilyEntry).slug.trim().length > 0 &&
          typeof (item as RecentFamilyEntry).name === "string" &&
          typeof (item as RecentFamilyEntry).updatedAt === "string"
      )
      .slice(0, MAX_RECENT_FAMILIES);
  } catch {
    return [];
  }
}

export function FamilyDashboard({
  initialFamily,
  initialHasApiKey,
  initialHasDatabase,
}: FamilyDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("board");
  const [hasApiKey, setHasApiKey] = useState(Boolean(initialHasApiKey));
  const [hasDatabase, setHasDatabase] = useState(
    Boolean(initialHasDatabase ?? initialFamily)
  );
  const [region, setRegion] = useState<SteamRegion>(
    initialFamily?.region ?? "ma"
  );
  const [includeExcluded, setIncludeExcluded] = useState(false);

  const [members, setMembers] = useState<FamilyMemberInput[]>(
    initialFamily?.members ?? []
  );
  const [waitlist, setWaitlist] = useState<FamilyMemberInput[]>(
    initialFamily?.waitlist ?? []
  );
  const [snapshots, setSnapshots] = useState<MonthlySnapshotRecord[]>(
    initialFamily?.snapshots ?? []
  );

  const [analysis, setAnalysis] = useState<FamilyAnalysis | null>(null);
  const [activeLibraries, setActiveLibraries] = useState<MemberLibrary[]>([]);
  const [waitlistLibraries, setWaitlistLibraries] = useState<MemberLibrary[]>([]);
  const [warnings, setWarnings] = useState<MemberWarning[]>([]);

  const [loading, setLoading] = useState(
    Boolean(initialFamily && initialFamily.members.length > 0)
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentFamilies, setRecentFamilies] = useState<RecentFamilyEntry[]>([]);

  const initialFamilySlug = initialFamily?.slug;
  const initialFamilyName = initialFamily?.name;
  const hasActiveRoster = members.length > 0;

  useEffect(() => {
    let cancelled = false;
    const existing = readRecentFamilies();
    if (initialFamilySlug && initialFamilyName) {
      const entry: RecentFamilyEntry = {
        slug: initialFamilySlug,
        name: initialFamilyName,
        updatedAt: new Date().toISOString(),
      };
      const next = [
        entry,
        ...existing.filter((item) => item.slug !== initialFamilySlug),
      ].slice(0, MAX_RECENT_FAMILIES);
      try {
        window.localStorage.setItem(
          RECENT_FAMILIES_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // ignore storage quota/privacy mode errors
      }
      queueMicrotask(() => {
        if (!cancelled) setRecentFamilies(next);
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) setRecentFamilies(existing);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialFamilySlug, initialFamilyName]);

  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((d) => {
        setHasApiKey(Boolean(d.hasApiKey));
        setHasDatabase(Boolean(d.hasDatabase));
      })
      .catch(() => {});
  }, []);

  const runAnalysis = useCallback(
    async (
      nextRegion: SteamRegion,
      nextIncludeExcluded: boolean,
      nextMembers: FamilyMemberInput[],
      nextWaitlist: FamilyMemberInput[]
    ) => {
      if (nextMembers.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "live",
            region: nextRegion,
            includeExcluded: nextIncludeExcluded,
            members: nextMembers,
            waitlist: nextWaitlist,
          }),
        });
        const data = (await res.json()) as AnalyzeResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        setAnalysis(data.analysis);
        setActiveLibraries(data.activeLibraries);
        setWaitlistLibraries(data.waitlistLibraries);
        setWarnings(data.warnings ?? []);
      } catch (err) {
        setWarnings([]);
        setError(
          err instanceof Error ? err.message : "Failed to load family data"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (members.length === 0) return;

    let cancelled = false;
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "live",
        region,
        includeExcluded,
        members,
        waitlist,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as AnalyzeResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setAnalysis(data.analysis);
        setActiveLibraries(data.activeLibraries);
        setWaitlistLibraries(data.waitlistLibraries);
        setWarnings(data.warnings ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setWarnings([]);
        setError(
          err instanceof Error ? err.message : "Failed to load family data"
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [region, includeExcluded, members, waitlist]);

  const getEditKeyForSlug = (slug: string): string | null => {
    try {
      const cached = sessionStorage.getItem(`sft_edit_key:${slug}`);
      if (cached) return cached;
    } catch {
      // ignore
    }
    const entered = window.prompt(
      "Enter this group's Edit Passcode to save changes:"
    );
    if (!entered?.trim()) return null;
    try {
      sessionStorage.setItem(`sft_edit_key:${slug}`, entered.trim());
    } catch {
      // ignore
    }
    return entered.trim();
  };

  const handleLaunchFamily = ({
    region: nextRegion,
    members: nextMembers,
    waitlist: nextWaitlist,
  }: {
    region: SteamRegion;
    members: FamilyMemberInput[];
    waitlist: FamilyMemberInput[];
  }) => {
    setRegion(nextRegion);
    setMembers(nextMembers);
    setWaitlist(nextWaitlist);
    setActiveTab("board");
    setAnalysis(null);
    setActiveLibraries([]);
    setWaitlistLibraries([]);
    setError(null);
    setWarnings([]);
    setNotice(null);
    setLoading(nextMembers.length > 0);
  };

  const handleResetToLaunchpad = () => {
    setMembers([]);
    setWaitlist([]);
    setAnalysis(null);
    setActiveLibraries([]);
    setWaitlistLibraries([]);
    setWarnings([]);
    setError(null);
    setNotice(null);
    setLoading(false);
    setActiveTab("board");
  };

  const handleBrandClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!initialFamily && hasActiveRoster) {
      e.preventDefault();
      handleResetToLaunchpad();
    }
  };

  const handleSaveMembers = async (
    nextMembers: FamilyMemberInput[],
    nextWaitlist: FamilyMemberInput[]
  ) => {
    setMembers(nextMembers);
    setWaitlist(nextWaitlist);
    setNotice(null);
    setError(null);

    if (nextMembers.length > 0) {
      setLoading(true);
    } else {
      setLoading(false);
      setAnalysis(null);
      setActiveLibraries([]);
      setWaitlistLibraries([]);
      setWarnings([]);
    }

    if (!initialFamily) return;
    const key = getEditKeyForSlug(initialFamily.slug);
    if (!key) return;

    try {
      const res = await fetch(`/api/families/${initialFamily.slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-edit-key": key,
        },
        body: JSON.stringify({
          region,
          members: nextMembers,
          waitlist: nextWaitlist,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(`sft_edit_key:${initialFamily.slug}`);
        }
        throw new Error(data.error ?? "Failed to persist member edits");
      }
      setNotice("Saved member changes to group.");
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save member edits"
      );
    }
  };

  const handleSaveSnapshot = async (monthKey: string) => {
    if (!initialFamily || !analysis) return;
    const key = getEditKeyForSlug(initialFamily.slug);
    if (!key) return;

    const res = await fetch(`/api/families/${initialFamily.slug}/snapshots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edit-key": key,
      },
      body: JSON.stringify({
        snapshotMonth: monthKey,
        analysis,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(`sft_edit_key:${initialFamily.slug}`);
      }
      setError(data.error ?? "Failed to record snapshot");
      return;
    }

    setSnapshots((prev) => {
      const filtered = prev.filter((s) => s.snapshotMonth !== data.snapshotMonth);
      return [data as MonthlySnapshotRecord, ...filtered].sort((a, b) =>
        b.snapshotMonth.localeCompare(a.snapshotMonth)
      );
    });
    setNotice(`Recorded ${monthKey} snapshot.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const activeNav =
    NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const activeRegion = STEAM_REGIONS[region];
  const upNextMember = analysis?.fairness?.upNextMemberId
    ? analysis.fairness.members.find(
        (m) => m.memberId === analysis.fairness.upNextMemberId
      ) ?? analysis.fairness.members.find((m) => m.isUpNext)
    : undefined;

  return (
    <div className="min-h-screen flex flex-col relative bg-bt-bg text-white overflow-x-clip">
      {/* Subtle ambient crimson micro-dot top backdrop */}
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none fixed inset-x-0 top-0 h-[420px] z-0 opacity-75"
      />

      {/* Top Command Header */}
      <header className="sticky top-0 z-30 bg-bt-bg/95 backdrop-blur-md border-b border-bt-border">
        {/* 2px solid crimson razor stripe */}
        <div className="h-[2px] w-full bg-bt-red" />

        <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              href="/"
              onClick={handleBrandClick}
              aria-label={
                !initialFamily && hasActiveRoster
                  ? "Return to SteamFamTrack Launchpad"
                  : "SteamFamTrack Home"
              }
              className="cursor-pointer shrink-0 p5-tag bg-bt-red hover:bg-bt-red-hover px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
            >
              <span className="p5-unskew font-display text-xl leading-none tracking-widest text-white">
                SF //
              </span>
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/"
                  onClick={handleBrandClick}
                  className="cursor-pointer min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  <h1 className="font-display text-2xl sm:text-3xl leading-none tracking-wider uppercase text-white hover:text-white/90 transition-colors truncate">
                    {initialFamily ? initialFamily.name : "STEAMFAMTRACK"}
                  </h1>
                </Link>
                <span
                  title={
                    hasApiKey
                      ? "Steam Web API connected"
                      : "STEAM_API_KEY not configured on server"
                  }
                  className={`p5-tag px-2.5 py-0.5 border ${
                    hasApiKey
                      ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                      : "bg-bt-red/15 border-bt-red/60 text-white"
                  }`}
                >
                  <span className="p5-unskew inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-widest">
                    <span
                      className={`h-1.5 w-1.5 ${
                        hasApiKey ? "bg-emerald-400" : "bg-bt-red"
                      }`}
                    />
                    LIVE STEAM API
                  </span>
                </span>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-bt-muted mt-1 truncate">
                {initialFamily
                  ? `/f/${initialFamily.slug}`
                  : "BELTEEZ STUDIO TELEMETRY"}
              </p>
            </div>
          </div>

          {/* Right Command Bar */}
          {hasActiveRoster ? (
            <div className="flex flex-wrap items-center gap-2 bg-bt-surface border border-bt-border p-1.5">
              {/* Region Picker */}
              <select
                aria-label="Pricing region"
                value={region}
                onChange={(e) => {
                  setLoading(true);
                  setRegion(e.target.value as SteamRegion);
                }}
                className="cursor-pointer bg-bt-bg border border-bt-border px-2.5 py-1.5 font-mono text-xs text-white hover:border-bt-muted transition-colors focus:border-bt-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
              >
                {Object.values(STEAM_REGIONS).map((r) => (
                  <option
                    key={r.code}
                    value={r.code}
                    className="bg-bt-bg text-white"
                  >
                    {r.label}
                  </option>
                ))}
              </select>

              {/* Edit Roster */}
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 bg-bt-elevated border border-bt-border px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:border-bt-red transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
              >
                <Users className="h-3.5 w-3.5 text-bt-red" />
                <span>Edit Roster</span>
                <span className="font-mono text-[11px] text-bt-muted">
                  ({members.length}/6)
                </span>
              </button>

              {/* Share Link / Save & Share */}
              {initialFamily ? (
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="cursor-pointer inline-flex items-center gap-1.5 bg-bt-bg border border-bt-red/50 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red/15 hover:border-bt-red transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 text-bt-red" />
                  )}
                  {copiedLink ? "Copied!" : "Share Link"}
                </button>
              ) : (
                hasDatabase && (
                  <button
                    type="button"
                    onClick={() => setSaveModalOpen(true)}
                    className="cursor-pointer inline-flex items-center gap-1.5 bg-bt-bg border border-bt-red/50 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red/15 hover:border-bt-red transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                  >
                    <Share2 className="h-3.5 w-3.5 text-bt-red" />
                    Save &amp; Share
                  </button>
                )
              )}

              {/* Primary Refresh CTA */}
              <button
                type="button"
                onClick={() =>
                  runAnalysis(region, includeExcluded, members, waitlist)
                }
                disabled={loading}
                className="cursor-pointer p5-btn inline-flex items-center gap-1.5 bg-bt-red hover:bg-bt-red-hover px-4 py-1.5 font-condensed text-xs font-extrabold uppercase tracking-widest text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-bt-dim">
              <span className="h-1.5 w-1.5 bg-bt-red" />
              <span>MAX 6 SLOTS // REAL-TIME STEAM PRICING</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content: Launchpad vs. Active 2-Column Workspace */}
      <main className="relative z-10 mx-auto w-full max-w-[1720px] flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {!hasActiveRoster ? (
          <FamilyLaunchpad
            initialRegion={region}
            hasApiKey={hasApiKey}
            recentFamilies={recentFamilies}
            loading={loading}
            error={error}
            onLaunch={handleLaunchFamily}
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)] gap-6 lg:gap-8">
            {/* Left Sticky Command Rail */}
            <aside className="xl:sticky xl:top-24 xl:self-start space-y-5">
              {/* 1. Tactical Navigation Stack */}
              <nav
                aria-label="Dashboard sections"
                className="bg-bt-surface border border-bt-border p-1.5"
              >
                <div className="hidden xl:flex items-center justify-between px-2.5 pt-1.5 pb-2 mb-1 border-b border-bt-border/80">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-dim">
                    NAVIGATION // MODULES
                  </span>
                  <span className="font-mono text-[10px] text-bt-red">
                    {activeNav.index}/04
                  </span>
                </div>

                <div className="flex xl:flex-col gap-1.5 overflow-x-auto xl:overflow-visible tier-rail pb-1.5 xl:pb-0">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`cursor-pointer shrink-0 xl:shrink group flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                          isActive
                            ? "bg-bt-elevated text-white border-l-[3px] border-l-bt-red border-y border-r border-y-bt-border border-r-bt-border"
                            : "bg-transparent text-bt-muted hover:text-white hover:bg-bt-elevated/60 border-l-[3px] border-l-transparent border-y border-r border-y-transparent border-r-transparent"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono text-[11px] tracking-wider ${
                              isActive
                                ? "text-bt-red font-medium"
                                : "text-bt-dim group-hover:text-bt-muted"
                            }`}
                          >
                            {item.index}
                          </span>
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? "text-white"
                                : "text-bt-dim group-hover:text-white"
                            }`}
                          />
                          <span className="font-condensed text-sm font-bold uppercase tracking-wider whitespace-nowrap xl:whitespace-normal">
                            {item.label}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          {item.id === "history" && snapshots.length > 0 && (
                            <span className="bg-bt-bg border border-bt-border px-1.5 py-0.5 font-mono text-[10px] text-white">
                              {snapshots.length}
                            </span>
                          )}
                          {isActive && (
                            <ChevronRight className="h-3.5 w-3.5 text-bt-red" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* 2. Family Status & 6-Slot Meter Card */}
              <div className="p5-frame bg-bt-border">
                <div className="bg-bt-surface p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                      ACTIVE SLOTS
                    </span>
                    <span className="font-mono text-xs font-medium text-white">
                      <span className="text-bt-red">{members.length}</span> / 6
                    </span>
                  </div>

                  {/* 6-Segment Visual Slot Bar */}
                  <div
                    className="grid grid-cols-6 gap-1.5"
                    role="img"
                    aria-label={`${members.length} of 6 active Steam Family slots occupied`}
                  >
                    {Array.from({ length: 6 }, (_, idx) => {
                      const filled = idx < members.length;
                      return (
                        <div
                          key={idx}
                          className={`h-2.5 transition-colors ${
                            filled ? "bg-bt-red" : "bg-bt-border/60"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Waitlist & Catalog Count */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="inline-flex items-center gap-2 bg-bt-elevated border border-bt-border px-2.5 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-bt-muted">
                        WAITLIST
                      </span>
                      <span className="font-mono text-xs font-medium text-white">
                        {waitlist.length}
                      </span>
                    </div>

                    {analysis && (
                      <span className="font-mono text-[11px] text-bt-dim">
                        {analysis.uniqueGamesCount} unique
                      </span>
                    )}
                  </div>

                  {/* Include Excluded Titles Toggle */}
                  <div className="border-t border-bt-border pt-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        id="include-excluded-label"
                        className="block font-condensed text-xs font-bold uppercase tracking-wider text-white"
                      >
                        Include excluded titles
                      </span>
                      <span className="block font-mono text-[10px] text-bt-dim mt-0.5">
                        {analysis
                          ? `${analysis.excludedGamesCount} non-shareable in catalog`
                          : "Non-Family-Sharing games"}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeExcluded}
                      aria-labelledby="include-excluded-label"
                      onClick={() => {
                        setLoading(true);
                        setIncludeExcluded((prev) => !prev);
                      }}
                      className={`cursor-pointer relative inline-flex h-5 w-10 shrink-0 items-center border p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                        includeExcluded
                          ? "bg-bt-red border-bt-red"
                          : "bg-bt-bg border-bt-border hover:border-bt-muted"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 bg-white transition-transform ${
                          includeExcluded
                            ? "translate-x-[18px]"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Quick Fairness Spotlight */}
              {analysis?.fairness?.upNextMemberName && (
                <div className="p5-frame bg-bt-red/70">
                  <div className="bg-bt-surface bg-gradient-to-br from-bt-red/10 via-bt-surface to-bt-surface p-4 space-y-3">
                    <div className="p5-tag bg-bt-red px-2 py-0.5">
                      <span className="p5-unskew font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white">
                        UP NEXT TO CONTRIBUTE
                      </span>
                    </div>

                    <div className="font-display text-2xl leading-none tracking-wide uppercase text-white truncate">
                      {analysis.fairness.upNextMemberName}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-bt-bg/85 border border-bt-border p-2.5">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                          CURRENT
                        </span>
                        <span className="font-mono text-sm font-medium text-bt-red">
                          {upNextMember
                            ? `${upNextMember.sharePercent.toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                      <div className="border-l border-bt-border pl-2.5">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                          EQUAL TARGET
                        </span>
                        <span className="font-mono text-sm font-medium text-white">
                          {analysis.fairness.expectedSharePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {activeTab !== "board" && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("board")}
                        className="cursor-pointer w-full flex items-center justify-between gap-2 bg-bt-elevated border border-bt-border hover:border-bt-red px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                      >
                        <span>Open Contribution Board</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-bt-red" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Recently Visited Saved Groups */}
              {recentFamilies.length > 0 && (
                <div className="bg-bt-surface border border-bt-border p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-bt-border/80">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                      <Bookmark className="h-3 w-3 text-bt-red" />
                      SAVED GROUPS
                    </span>
                    <span className="font-mono text-[10px] text-bt-dim">
                      {recentFamilies.length}
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {recentFamilies.map((fam) => {
                      const isCurrent = initialFamily?.slug === fam.slug;
                      return (
                        <li key={fam.slug}>
                          <Link
                            href={`/f/${fam.slug}`}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`cursor-pointer group flex items-center justify-between gap-2 px-2.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                              isCurrent
                                ? "bg-bt-elevated border-l-[3px] border-l-bt-red border-y border-r border-y-bt-border border-r-bt-border text-white"
                                : "bg-bt-bg/70 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/60 text-bt-muted hover:text-white"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
                                {fam.name}
                              </span>
                              <span className="block font-mono text-[10px] text-bt-dim truncate">
                                /f/{fam.slug}
                              </span>
                            </span>
                            {isCurrent ? (
                              <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-bt-red font-medium">
                                ACTIVE
                              </span>
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-bt-dim group-hover:text-bt-red transition-colors" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 5. Start New Family Reset (Unsaved Session Only) */}
              {!initialFamily && (
                <button
                  type="button"
                  onClick={handleResetToLaunchpad}
                  className="cursor-pointer w-full inline-flex items-center justify-center gap-2 bg-bt-surface border border-bt-border hover:border-bt-red/70 hover:bg-bt-elevated px-3.5 py-2.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-bt-red" />
                  <span>Start New Family</span>
                </button>
              )}

              {/* 6. Minimal Studio Signature Footer */}
              <div className="hidden xl:block pt-2 border-t border-bt-border/60 font-mono text-[10px] tracking-[0.2em] text-bt-dim uppercase">
                BELTEEZ STUDIO // STEAM FAMILY ANALYZER
              </div>
            </aside>

            {/* Right Main Stage */}
            <section className="min-w-0 space-y-6">
              {/* Active View Section Header Bar */}
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-bt-border pb-4">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-sm sm:text-base font-medium text-bt-red tracking-wider shrink-0">
                    {`${activeNav.index} //`}
                  </span>
                  <h2 className="font-display text-3xl sm:text-4xl leading-none tracking-wider uppercase text-white truncate">
                    {activeNav.sectionTitle}
                  </h2>
                </div>

                <div className="inline-flex items-center gap-2 bg-bt-surface border border-bt-border px-3 py-1.5 font-mono text-xs shrink-0">
                  <span className="h-1.5 w-1.5 bg-bt-red" />
                  <span className="text-white font-medium">
                    {activeRegion.currency} ({activeRegion.symbol})
                  </span>
                  <span className="text-bt-dim">{"//"}</span>
                  <span className="text-bt-muted">{activeRegion.label}</span>
                </div>
              </div>

              {/* Notice Banner */}
              {notice && (
                <div
                  role="status"
                  className="border border-emerald-500/40 border-l-4 border-l-emerald-400 bg-emerald-950/30 px-4 py-3 font-mono text-xs sm:text-sm text-emerald-200"
                >
                  {notice}
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div
                  role="alert"
                  className="border border-bt-red/40 border-l-4 border-l-bt-red bg-bt-red/10 px-4 py-3 text-sm text-white flex flex-wrap items-center justify-between gap-4"
                >
                  <span className="font-mono text-xs sm:text-sm">{error}</span>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 bg-bt-elevated border border-bt-red/60 hover:bg-bt-red px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Edit Roster
                  </button>
                </div>
              )}

              {/* Per-Member Lookup Warnings Banner */}
              {warnings.length > 0 && (
                <div
                  role="status"
                  className="border-y border-r border-amber-500/35 border-l-4 border-l-amber-400 bg-amber-500/10 px-5 py-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-condensed text-sm font-bold uppercase tracking-wider text-amber-200">
                          {warnings.length === 1
                            ? "1 Member Lookup Issue"
                            : `${warnings.length} Member Lookup Issues`}
                        </p>
                        <p className="font-mono text-[11px] text-amber-200/75 mt-0.5">
                          Fix Steam IDs/URLs or ask affected members to set
                          Steam Privacy &rarr; Game Details to Public.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 bg-bt-elevated border border-amber-400/50 hover:border-amber-300 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-amber-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    >
                      <Users className="h-3.5 w-3.5 text-amber-400" />
                      Edit Roster
                    </button>
                  </div>

                  <ul className="space-y-1.5 border-t border-amber-500/20 pt-2.5">
                    {warnings.map((w) => (
                      <li
                        key={`${w.memberId}-${w.steamInput}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs text-amber-100/90"
                      >
                        <span className="font-semibold text-white">
                          {w.memberName}
                        </span>
                        {w.steamInput && (
                          <span className="text-[11px] text-amber-200/60">
                            ({w.steamInput})
                          </span>
                        )}
                        <span className="text-amber-400">{"//"}</span>
                        <span className="text-amber-100/85">{w.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Main View Content */}
              {loading && !analysis ? (
                <div className="p5-frame bg-bt-border">
                  <div className="bg-bt-surface flex flex-col items-center justify-center py-24 px-6 gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-bt-red" />
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-bt-muted">
                      Analyzing Steam Family libraries...
                    </p>
                  </div>
                </div>
              ) : (
                analysis && (
                  <>
                    {activeTab === "board" && (
                      <ContributionBoard analysis={analysis} />
                    )}
                    {activeTab === "overlap" && (
                      <OverlapAndCatalog analysis={analysis} />
                    )}
                    {activeTab === "simulator" && (
                      <SwapSimulator
                        activeLibraries={activeLibraries}
                        waitlistLibraries={waitlistLibraries}
                        region={region}
                        includeExcluded={includeExcluded}
                      />
                    )}
                    {activeTab === "history" && (
                      <MonthlyHistory
                        slug={initialFamily?.slug}
                        analysis={analysis}
                        snapshots={snapshots}
                        hasDatabase={hasDatabase}
                        onSaveSnapshot={
                          initialFamily ? handleSaveSnapshot : undefined
                        }
                        onOpenSaveModal={() => setSaveModalOpen(true)}
                      />
                    )}
                  </>
                )
              )}

              {/* Mobile Studio Signature */}
              <div className="xl:hidden pt-4 border-t border-bt-border/60 font-mono text-[10px] tracking-[0.2em] text-bt-dim uppercase">
                BELTEEZ STUDIO // STEAM FAMILY ANALYZER
              </div>
            </section>
          </div>
        )}
      </main>

      <MemberEditorModal
        key={`${editorOpen}-${members.length}-${waitlist.length}`}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        members={members}
        waitlist={waitlist}
        hasApiKey={hasApiKey}
        onSave={handleSaveMembers}
      />

      <SaveFamilyModal
        key={`save-${saveModalOpen}`}
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        region={region}
        members={members}
        waitlist={waitlist}
        analysis={analysis}
      />
    </div>
  );
}
