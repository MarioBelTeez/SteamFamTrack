"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ContributionBoard } from "@/components/ContributionBoard";
import { MemberEditorModal } from "@/components/MemberEditorModal";
import { MonthlyHistory } from "@/components/MonthlyHistory";
import { OverlapAndCatalog } from "@/components/OverlapAndCatalog";
import { SaveFamilyModal } from "@/components/SaveFamilyModal";
import { SwapSimulator } from "@/components/SwapSimulator";
import { DEMO_ACTIVE_INPUTS, DEMO_WAITLIST_INPUTS } from "@/lib/demo-data";
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
  ArrowRightLeft,
  BarChart3,
  Calendar,
  Check,
  Gamepad2,
  Grid3X3,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Users,
} from "lucide-react";

type TabId = "board" | "overlap" | "simulator" | "history";

interface AnalyzeResponse {
  mode: "demo" | "live";
  analysis: FamilyAnalysis;
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  error?: string;
}

interface FamilyDashboardProps {
  initialFamily?: SavedFamilyData;
}

export function FamilyDashboard({ initialFamily }: FamilyDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("board");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasDatabase, setHasDatabase] = useState(Boolean(initialFamily));
  const [region, setRegion] = useState<SteamRegion>(
    initialFamily?.region ?? "ma"
  );
  const [includeExcluded, setIncludeExcluded] = useState(false);

  const [members, setMembers] = useState<FamilyMemberInput[]>(
    initialFamily?.members ?? DEMO_ACTIVE_INPUTS
  );
  const [waitlist, setWaitlist] = useState<FamilyMemberInput[]>(
    initialFamily?.waitlist ?? DEMO_WAITLIST_INPUTS
  );
  const [snapshots, setSnapshots] = useState<MonthlySnapshotRecord[]>(
    initialFamily?.snapshots ?? []
  );

  const [analysis, setAnalysis] = useState<FamilyAnalysis | null>(null);
  const [activeLibraries, setActiveLibraries] = useState<MemberLibrary[]>([]);
  const [waitlistLibraries, setWaitlistLibraries] = useState<MemberLibrary[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
      nextMode: "demo" | "live",
      nextRegion: SteamRegion,
      nextIncludeExcluded: boolean,
      nextMembers: FamilyMemberInput[],
      nextWaitlist: FamilyMemberInput[]
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: nextMode,
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
      } catch (err) {
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
    let cancelled = false;
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
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
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load family data"
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, region, includeExcluded, members, waitlist]);

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

  const handleSaveMembers = async (
    nextMembers: FamilyMemberInput[],
    nextWaitlist: FamilyMemberInput[]
  ) => {
    setMembers(nextMembers);
    setWaitlist(nextWaitlist);

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#111a27]/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20"
            >
              <Gamepad2 className="h-5 w-5 text-white" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  {initialFamily ? initialFamily.name : "SteamFamTrack"}
                </h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                    mode === "live"
                      ? "bg-lime-500/10 text-lime-400 border-lime-500/30"
                      : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                  }`}
                >
                  {mode === "live" ? "Live API" : "Demo Mode"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {initialFamily
                  ? `Saved family /f/${initialFamily.slug}`
                  : "Steam Family contribution shares, overlap matrix & 1-year slot simulator"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switch */}
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs">
              <button
                onClick={() => setMode("demo")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === "demo"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => setMode("live")}
                title={
                  hasApiKey
                    ? "Fetch live Steam profiles"
                    : "Requires STEAM_API_KEY in .env.local"
                }
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === "live"
                    ? "bg-lime-400 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Live API
              </button>
            </div>

            {/* Region Picker */}
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as SteamRegion)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              {Object.values(STEAM_REGIONS).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExcluded}
                onChange={(e) => setIncludeExcluded(e.target.checked)}
                className="accent-sky-500"
              />
              Include excluded
            </label>

            <button
              onClick={() => setEditorOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              <Users className="h-3.5 w-3.5 text-sky-400" />
              Edit ({members.length}/6)
            </button>

            {initialFamily ? (
              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25"
              >
                {copiedLink ? (
                  <Check className="h-3.5 w-3.5 text-lime-400" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {copiedLink ? "Copied!" : "Share Link"}
              </button>
            ) : (
              hasDatabase && (
                <button
                  onClick={() => setSaveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Save &amp; Share
                </button>
              )
            )}

            <button
              onClick={() =>
                runAnalysis(mode, region, includeExcluded, members, waitlist)
              }
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("board")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === "board"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Contribution Board
          </button>

          <button
            onClick={() => setActiveTab("overlap")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === "overlap"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            Overlap &amp; Catalog
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === "simulator"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Waitlist &amp; Swap Simulator
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Monthly Deltas
            {snapshots.length > 0 && (
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-sky-300">
                {snapshots.length}
              </span>
            )}
          </button>
        </div>

        {notice && (
          <div className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm text-lime-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-4">
            <span>{error}</span>
            {mode === "live" && (
              <button
                onClick={() => setMode("demo")}
                className="shrink-0 rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500/30"
              >
                Switch to Demo Mode
              </button>
            )}
          </div>
        )}

        {loading && !analysis ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
            <p className="text-sm">Analyzing Steam Family libraries...</p>
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
      </main>

      <MemberEditorModal
        key={`${editorOpen}-${members.length}-${waitlist.length}`}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        members={members}
        waitlist={waitlist}
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
