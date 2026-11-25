"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FamilyMemberInput,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  FolderOpen,
  Globe,
  Grid2x2,
  Loader2,
  Lock,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

export interface RecentFamilyEntry {
  slug: string;
  name: string;
  updatedAt: string;
}

export interface FamilyLaunchpadProps {
  initialRegion: SteamRegion;
  hasApiKey: boolean;
  recentFamilies: RecentFamilyEntry[];
  loading: boolean;
  error: string | null;
  onLaunch: (payload: {
    region: SteamRegion;
    members: FamilyMemberInput[];
    waitlist: FamilyMemberInput[];
  }) => void;
}

interface RowVerification {
  status: "loading" | "public" | "private" | "error";
  steamId64?: string;
  personaName?: string;
  avatarUrl?: string;
  gameCount?: number | null;
  message?: string;
}

interface ResolveApiResponse {
  steamId64?: string;
  personaName?: string;
  avatarUrl?: string;
  avatar?: string;
  profileUrl?: string;
  isLibraryPublic?: boolean;
  isPublic?: boolean;
  gamesPublic?: boolean;
  libraryPublic?: boolean;
  isPrivate?: boolean;
  gameCount?: number | null;
  gamesCount?: number | null;
  totalGames?: number | null;
  hint?: string;
  warning?: string;
  error?: string;
}

function isPlaceholderName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /^(New Member|Waitlist Friend|Member \d+|Waitlist \d+)$/i.test(
    trimmed
  );
}

function deriveFallbackName(
  steamInput: string,
  index: number,
  isWait: boolean
): string {
  const trimmed = steamInput.trim().replace(/\/+$/, "");
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (vanityMatch?.[1]) return vanityMatch[1];

  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch?.[1]) return `Steam ${profileMatch[1].slice(-4)}`;

  if (/^\d{17}$/.test(trimmed)) return `Steam ${trimmed.slice(-4)}`;
  if (trimmed && !trimmed.includes("/")) return trimmed;

  return isWait ? `Waitlist ${index + 1}` : `Member ${index + 1}`;
}

function parseBulkLines(raw: string): string[] {
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(line);
  }
  return parsed;
}

function extractFamilySlug(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/f\/([^/?#]+)/i);
  if (urlMatch?.[1]) return urlMatch[1].trim();
  return trimmed.replace(/^\/+/, "");
}

function formatUpdatedDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const CAPABILITIES = [
  {
    code: "01",
    label: "REGIONAL RAW VALUE & FAIRNESS",
    detail: "Non-discounted regional store pricing and Up-Next fairness delta.",
    icon: BarChart3,
  },
  {
    code: "02",
    label: "OVERLAP HEATMAP & ART CATALOG",
    detail: "Shared vs. exclusive library matrix with searchable cover catalog.",
    icon: Grid2x2,
  },
  {
    code: "03",
    label: "1-YEAR COOLDOWNS & SWAP SIM",
    detail: "Track Steam Family slot unlock dates and simulate roster swaps.",
    icon: Clock,
  },
] as const;

export function FamilyLaunchpad({
  initialRegion,
  hasApiKey,
  recentFamilies,
  loading,
  error,
  onLaunch,
}: FamilyLaunchpadProps) {
  const router = useRouter();
  const [region, setRegion] = useState<SteamRegion>(initialRegion);
  const [quickSlug, setQuickSlug] = useState<string>("");

  const [draftMembers, setDraftMembers] = useState<FamilyMemberInput[]>(() => [
    {
      id: "lp-m-1",
      name: "",
      steamUrlOrId: "",
      joinDate: "",
      isWaitlist: false,
    },
    {
      id: "lp-m-2",
      name: "",
      steamUrlOrId: "",
      joinDate: "",
      isWaitlist: false,
    },
  ]);

  const [draftWaitlist, setDraftWaitlist] = useState<FamilyMemberInput[]>([]);
  const [waitlistOpen, setWaitlistOpen] = useState<boolean>(false);
  const [bulkOpen, setBulkOpen] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [verifications, setVerifications] = useState<
    Record<string, RowVerification>
  >({});
  const [localError, setLocalError] = useState<string | null>(null);

  const idCounterRef = useRef<number>(2);
  const nextRowId = (prefix: "m" | "w") => {
    idCounterRef.current += 1;
    return `lp-${prefix}-${Date.now()}-${idCounterRef.current}`;
  };

  const handleQuickJump = (e: FormEvent) => {
    e.preventDefault();
    const slug = extractFamilySlug(quickSlug);
    if (!slug) return;
    router.push(`/f/${encodeURIComponent(slug)}`);
  };

  const updateRow = (
    isWait: boolean,
    id: string,
    patch: Partial<FamilyMemberInput>
  ) => {
    setLocalError(null);
    if (isWait) {
      setDraftWaitlist((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    } else {
      setDraftMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    }
    if (patch.steamUrlOrId !== undefined) {
      setVerifications((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addMember = (isWait: boolean) => {
    setLocalError(null);
    const today = new Date().toISOString().slice(0, 10);
    const newItem: FamilyMemberInput = {
      id: nextRowId(isWait ? "w" : "m"),
      name: "",
      steamUrlOrId: "",
      joinDate: isWait ? undefined : today,
      isWaitlist: isWait,
    };
    if (isWait) {
      setWaitlistOpen(true);
      setDraftWaitlist((prev) => [...prev, newItem]);
    } else if (draftMembers.length < 6) {
      setDraftMembers((prev) => [...prev, newItem]);
    }
  };

  const verifyRow = async (
    rowId: string,
    steamUrlOrId: string,
    isWait: boolean
  ) => {
    const input = steamUrlOrId.trim();
    if (!input || !hasApiKey) return;

    setVerifications((prev) => ({
      ...prev,
      [rowId]: { status: "loading" },
    }));

    try {
      const res = await fetch("/api/steam/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const data = (await res.json().catch(() => ({}))) as ResolveApiResponse;

      if (!res.ok || data.error) {
        setVerifications((prev) => ({
          ...prev,
          [rowId]: {
            status: "error",
            message:
              data.error ?? `Could not resolve "${input}" (${res.status})`,
          },
        }));
        return;
      }

      const rawCount =
        typeof data.gameCount === "number"
          ? data.gameCount
          : typeof data.gamesCount === "number"
            ? data.gamesCount
            : typeof data.totalGames === "number"
              ? data.totalGames
              : null;

      const isPublic =
        typeof data.isLibraryPublic === "boolean"
          ? data.isLibraryPublic
          : typeof data.gamesPublic === "boolean"
            ? data.gamesPublic
            : typeof data.libraryPublic === "boolean"
              ? data.libraryPublic
              : typeof data.isPublic === "boolean"
                ? data.isPublic
                : typeof data.isPrivate === "boolean"
                  ? !data.isPrivate
                  : rawCount !== null;

      const personaName = data.personaName?.trim() || "";
      const avatarUrl = data.avatarUrl || data.avatar || "";

      setVerifications((prev) => ({
        ...prev,
        [rowId]: {
          status: isPublic ? "public" : "private",
          steamId64: data.steamId64,
          personaName,
          avatarUrl,
          gameCount: rawCount,
          message:
            data.hint ??
            data.warning ??
            (isPublic
              ? undefined
              : "Set Steam Privacy -> Game Details to Public"),
        },
      }));

      if (personaName) {
        const updateList = isWait ? setDraftWaitlist : setDraftMembers;
        updateList((prev) =>
          prev.map((row) =>
            row.id === rowId && isPlaceholderName(row.name)
              ? { ...row, name: personaName }
              : row
          )
        );
      }
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [rowId]: {
          status: "error",
          message:
            err instanceof Error ? err.message : "Network error during lookup",
        },
      }));
    }
  };

  const handleBulkImport = async () => {
    const lines = parseBulkLines(bulkText).slice(0, 6);
    if (lines.length === 0) return;

    setLocalError(null);
    const today = new Date().toISOString().slice(0, 10);
    const importedRows: FamilyMemberInput[] = lines.map((line) => ({
      id: nextRowId("m"),
      name: "",
      steamUrlOrId: line,
      joinDate: today,
      isWaitlist: false,
    }));

    setDraftMembers(importedRows);
    setVerifications({});
    setBulkOpen(false);
    setBulkText("");

    if (hasApiKey) {
      setBulkBusy(true);
      try {
        await Promise.all(
          importedRows.map((row) => verifyRow(row.id, row.steamUrlOrId, false))
        );
      } finally {
        setBulkBusy(false);
      }
    }
  };

  const handleVerifyAllActive = async () => {
    if (!hasApiKey) return;
    const targets = draftMembers.filter((m) => m.steamUrlOrId.trim().length > 0);
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        targets.map((row) => verifyRow(row.id, row.steamUrlOrId, false))
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const cleanActiveMembers = draftMembers
    .filter((m) => m.steamUrlOrId.trim().length > 0)
    .map((m, idx) => ({
      ...m,
      name:
        m.name.trim() ||
        verifications[m.id]?.personaName ||
        deriveFallbackName(m.steamUrlOrId, idx, false),
      steamUrlOrId: m.steamUrlOrId.trim(),
      joinDate: m.joinDate?.trim() || undefined,
      isWaitlist: false,
    }));

  const cleanWaitlistMembers = draftWaitlist
    .filter((w) => w.steamUrlOrId.trim().length > 0)
    .map((w, idx) => ({
      ...w,
      name:
        w.name.trim() ||
        verifications[w.id]?.personaName ||
        deriveFallbackName(w.steamUrlOrId, idx, true),
      steamUrlOrId: w.steamUrlOrId.trim(),
      isWaitlist: true,
    }));

  const parsedBulkLines = parseBulkLines(bulkText);
  const verifiableActiveCount = draftMembers.filter(
    (m) => m.steamUrlOrId.trim().length > 0
  ).length;

  const handleAnalyze = () => {
    if (!hasApiKey) {
      setLocalError(
        "STEAM_API_KEY is not configured on the server. Configure it in .env.local to analyze live Steam libraries."
      );
      return;
    }
    if (cleanActiveMembers.length === 0) {
      setLocalError(
        "Add at least one Steam profile URL, vanity name, or SteamID64 to analyze."
      );
      return;
    }
    setLocalError(null);
    onLaunch({
      region,
      members: cleanActiveMembers,
      waitlist: cleanWaitlistMembers,
    });
  };

  const renderVerificationStrip = (row: FamilyMemberInput) => {
    const v = verifications[row.id];
    if (!v) return null;

    if (v.status === "loading") {
      return (
        <div className="mt-2 flex items-center gap-2 border-t border-bt-border/60 pt-2 font-mono text-[11px] text-bt-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-bt-red shrink-0" />
          <span>Resolving Steam profile &amp; game visibility...</span>
        </div>
      );
    }

    if (v.status === "error") {
      return (
        <div className="mt-2 flex items-center gap-2 border-t border-bt-red/30 pt-2 font-mono text-[11px] text-bt-red">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={v.message}>
            {v.message ?? "Profile lookup failed"}
          </span>
        </div>
      );
    }

    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-bt-border/60 pt-2">
        <div className="flex items-center gap-2 min-w-0">
          {v.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.avatarUrl}
              alt={v.personaName || row.name || "Steam avatar"}
              className="h-6 w-6 shrink-0 object-cover border border-bt-border"
            />
          ) : (
            <div className="h-6 w-6 shrink-0 border border-bt-border bg-bt-bg flex items-center justify-center font-mono text-[10px] text-bt-muted">
              {(v.personaName || row.name || "ST").slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-mono text-xs text-white truncate">
            {v.personaName || row.name || v.steamId64}
          </span>
          {v.steamId64 && (
            <span className="hidden md:inline font-mono text-[10px] text-bt-dim">
              {v.steamId64}
            </span>
          )}
        </div>

        {v.status === "public" ? (
          <span className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            {typeof v.gameCount === "number"
              ? `PUBLIC · ${v.gameCount} GAMES`
              : "PUBLIC LIBRARY"}
          </span>
        ) : (
          <span
            title={
              v.message ||
              "Open Steam Profile -> Edit Profile -> Privacy Settings -> set Game details to Public."
            }
            className="inline-flex items-center gap-1.5 border border-amber-500/45 bg-amber-950/50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300"
          >
            <Lock className="h-3 w-3 shrink-0" />
            <span>PRIVATE LIBRARY</span>
            <span className="hidden sm:inline font-normal normal-case tracking-normal text-amber-200/80">
              — Set Game Details to Public
            </span>
          </span>
        )}
      </div>
    );
  };

  const activeError = localError || error;

  return (
    <section className="w-full py-4 sm:py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)] gap-8 items-start">
        {/* Left Hero Column */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="p5-tag bg-bt-red px-3 py-1">
              <span className="p5-unskew inline-flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-[0.2em] text-white">
                <Radio className="h-3.5 w-3.5" />
                LIVE STEAM TELEMETRY
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-5xl sm:text-6xl leading-[0.95] tracking-wider uppercase text-white">
                TRACK YOUR STEAM FAMILY
              </h1>
              <div className="flex items-center gap-2">
                <span className="h-1 w-20 bg-bt-red" />
                <span className="h-1 w-4 bg-white/80" />
              </div>
            </div>

            <p className="text-sm sm:text-[15px] leading-relaxed text-bt-muted">
              Pull real regional store values, compare shared versus exclusive
              games, audit your Fairness Meter, and simulate 1-year slot
              cooldowns before swapping a single seat.
            </p>
          </div>

          {/* 3-Item Numbered Capability Strip */}
          <div className="space-y-2.5">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.code}
                  className="border border-bt-border border-l-2 border-l-bt-red bg-bt-surface/90 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-bt-red" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                      <span className="text-bt-red">{item.code}</span>
                      {" // "}
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-bt-muted">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Open Saved Family /f/ Quick-Jump Card */}
          <div className="p5-frame bg-bt-border">
            <div className="bg-bt-surface p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-bt-red shrink-0" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-white">
                    Open Saved Family
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                  /f/&lt;slug&gt;
                </span>
              </div>

              <form onSubmit={handleQuickJump} className="flex items-stretch gap-2">
                <div className="flex flex-1 items-center border border-bt-border bg-bt-bg focus-within:border-bt-red transition-colors">
                  <span className="select-none pl-3 pr-1 font-mono text-xs text-bt-dim">
                    /f/
                  </span>
                  <input
                    type="text"
                    value={quickSlug}
                    onChange={(e) => setQuickSlug(e.target.value)}
                    aria-label="Saved family slug or link"
                    placeholder="your-family-slug"
                    className="w-full bg-transparent py-2 pr-2.5 font-mono text-xs text-white placeholder:text-bt-dim focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!extractFamilySlug(quickSlug)}
                  className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <span>Open</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              {recentFamilies.length > 0 && (
                <div className="border-t border-bt-border/80 pt-3 space-y-2">
                  <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.2em] text-bt-muted">
                    Recent Saved Groups ({recentFamilies.length})
                  </div>
                  <div className="space-y-1.5">
                    {recentFamilies.map((f) => (
                      <Link
                        key={f.slug}
                        href={`/f/${f.slug}`}
                        className="cursor-pointer group flex items-center justify-between gap-3 border border-bt-border bg-bt-elevated/70 px-3 py-2 transition-colors hover:border-bt-red hover:bg-bt-elevated"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-condensed text-sm font-bold uppercase tracking-wide text-white group-hover:text-bt-red transition-colors">
                            {f.name}
                          </div>
                          <div className="truncate font-mono text-[10px] text-bt-dim">
                            /f/{f.slug}
                            {f.updatedAt
                              ? ` · ${formatUpdatedDate(f.updatedAt)}`
                              : ""}
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-bt-muted group-hover:text-bt-red group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Interactive Steam Family Builder */}
        <div className="p5-frame bg-bt-red/70 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <div className="bg-bt-surface p-6 space-y-5">
            {/* Builder Top Bar */}
            <div className="flex flex-col gap-4 border-b border-bt-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl tracking-wider uppercase text-white leading-none">
                        BUILD YOUR ROSTER (UP TO 6 SLOTS)
                      </h2>
                      <span className="border border-bt-border bg-bt-elevated px-2 py-0.5 font-mono text-[10px] text-bt-muted">
                        {draftMembers.length}/6 SLOTS
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-bt-muted">
                      Paste Steam profile URLs, vanity names, or SteamID64s.
                      Steam Game Details must be Public.
                    </p>
                  </div>
                </div>

                {/* Region Selector */}
                <label className="flex items-center gap-2 border border-bt-border bg-bt-bg px-2.5 py-1.5 focus-within:border-bt-red transition-colors">
                  <Globe className="h-3.5 w-3.5 text-bt-red shrink-0" />
                  <span className="font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                    Region
                  </span>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as SteamRegion)}
                    aria-label="Steam store pricing region"
                    className="cursor-pointer bg-bt-bg font-mono text-xs text-white focus:outline-none"
                  >
                    {Object.values(STEAM_REGIONS).map((r) => (
                      <option
                        key={r.code}
                        value={r.code}
                        className="bg-bt-surface text-white"
                      >
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Action Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkOpen((prev) => !prev)}
                    className={`cursor-pointer inline-flex items-center gap-1.5 border px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                      bulkOpen
                        ? "border-bt-red bg-bt-red/15 text-white"
                        : "border-bt-border bg-bt-elevated text-white hover:border-bt-red"
                    }`}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 text-bt-red" />
                    <span>Bulk Paste URLs</span>
                    {bulkOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-bt-muted" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-bt-muted" />
                    )}
                  </button>

                  {hasApiKey && (
                    <button
                      type="button"
                      onClick={handleVerifyAllActive}
                      disabled={bulkBusy || verifiableActiveCount === 0}
                      className="cursor-pointer inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-emerald-200 hover:border-emerald-400 hover:bg-emerald-950/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {bulkBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      <span>
                        Verify All
                        {verifiableActiveCount > 0
                          ? ` (${verifiableActiveCount})`
                          : ""}
                      </span>
                    </button>
                  )}
                </div>

                {draftMembers.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addMember(false)}
                    className="cursor-pointer inline-flex items-center gap-1 border border-bt-red/50 bg-bt-red/10 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Slot</span>
                  </button>
                )}
              </div>
            </div>

            {/* Missing API Key Warning */}
            {!hasApiKey && (
              <div
                role="alert"
                className="flex items-start gap-2.5 border border-amber-500/45 border-l-4 border-l-amber-400 bg-amber-950/40 px-3.5 py-3"
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-200">
                    STEAM_API_KEY Missing on Server
                  </div>
                  <p className="font-mono text-xs text-amber-200/85">
                    Add <code className="text-white">STEAM_API_KEY</code> to{" "}
                    <code className="text-white">.env.local</code> (or Vercel
                    environment variables) to verify profiles and launch live
                    Steam Family analysis.
                  </p>
                </div>
              </div>
            )}

            {/* Runtime / Validation Error */}
            {activeError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 border border-bt-red/55 border-l-4 border-l-bt-red bg-bt-red/15 px-3.5 py-3 font-mono text-xs text-white"
              >
                <XCircle className="h-4 w-4 text-bt-red shrink-0 mt-0.5" />
                <span>{activeError}</span>
              </div>
            )}

            {/* Toggleable Bulk Paste Panel */}
            {bulkOpen && (
              <div className="border border-bt-red/45 bg-bt-elevated/90 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="h-4 w-4 text-bt-red" />
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-white">
                      Bulk Paste Steam Profiles (1–6 Lines)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-bt-muted">
                    {Math.min(parsedBulkLines.length, 6)} / 6 detected
                    {parsedBulkLines.length > 6
                      ? ` (${parsedBulkLines.length - 6} extra ignored)`
                      : ""}
                  </span>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  aria-label="Bulk paste Steam profile URLs, vanity names, or SteamID64s"
                  placeholder={
                    "https://steamcommunity.com/id/yourvanity\nhttps://steamcommunity.com/profiles/76561198012345678\nvanity_username"
                  }
                  className="w-full border border-bt-border bg-bt-bg p-3 font-mono text-xs text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                    Populates active slots ·{" "}
                    {hasApiKey
                      ? "Auto-resolves persona names, avatars & game counts"
                      : "One Steam URL, vanity name, or SteamID64 per line"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkText("")}
                      disabled={!bulkText}
                      className="cursor-pointer border border-bt-border px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted hover:border-white/40 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkImport}
                      disabled={parsedBulkLines.length === 0 || bulkBusy}
                      className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-4 py-1.5 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {bulkBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {hasApiKey ? "Import & Verify" : "Import URLs"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Roster Rows */}
            <div className="space-y-2">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2.5 pb-1 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                <span className="sm:col-span-3">Display Name (Optional)</span>
                <span className={hasApiKey ? "sm:col-span-4" : "sm:col-span-5"}>
                  Steam URL, Vanity or SteamID64
                </span>
                <span className="sm:col-span-3">Join Date</span>
                <span
                  className={
                    hasApiKey
                      ? "sm:col-span-2 text-right pr-1"
                      : "sm:col-span-1 text-center"
                  }
                >
                  {hasApiKey ? "Verify / Del" : "Del"}
                </span>
              </div>

              {draftMembers.map((m, idx) => {
                const v = verifications[m.id];
                const isVerifying = v?.status === "loading";
                return (
                  <div
                    key={m.id}
                    className="border border-bt-border bg-bt-elevated/80 p-2.5 transition-colors focus-within:border-bt-red/60"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) =>
                          updateRow(false, m.id, { name: e.target.value })
                        }
                        aria-label={`Slot ${idx + 1} display name`}
                        placeholder="Auto-filled on verify"
                        className="sm:col-span-3 border border-bt-border bg-bt-bg px-2.5 py-2 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                      />
                      <input
                        type="text"
                        value={m.steamUrlOrId}
                        onChange={(e) =>
                          updateRow(false, m.id, {
                            steamUrlOrId: e.target.value,
                          })
                        }
                        aria-label={`Slot ${idx + 1} Steam URL, vanity name, or SteamID64`}
                        placeholder="steamcommunity.com/id/... or 7656119..."
                        className={`${
                          hasApiKey ? "sm:col-span-4" : "sm:col-span-5"
                        } border border-bt-border bg-bt-bg px-2.5 py-2 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none`}
                      />
                      <input
                        type="date"
                        value={m.joinDate ?? ""}
                        onChange={(e) =>
                          updateRow(false, m.id, { joinDate: e.target.value })
                        }
                        aria-label={`Slot ${idx + 1} join date`}
                        className="sm:col-span-3 border border-bt-border bg-bt-bg px-2 py-2 font-mono text-xs sm:text-sm text-white [color-scheme:dark] focus:border-bt-red focus:outline-none"
                      />
                      <div
                        className={`${
                          hasApiKey ? "sm:col-span-2" : "sm:col-span-1"
                        } flex items-center justify-end gap-1.5`}
                      >
                        {hasApiKey && (
                          <button
                            type="button"
                            onClick={() =>
                              verifyRow(m.id, m.steamUrlOrId, false)
                            }
                            disabled={!m.steamUrlOrId.trim() || isVerifying}
                            title="Verify Steam profile & public game count"
                            aria-label={`Verify ${m.name || `slot ${idx + 1}`}`}
                            className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-bg px-2.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-wider text-white hover:border-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            {isVerifying ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-bt-red" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            <span>Verify</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDraftMembers((prev) =>
                              prev.filter((x) => x.id !== m.id)
                            );
                            setVerifications((prev) => {
                              const next = { ...prev };
                              delete next[m.id];
                              return next;
                            });
                          }}
                          disabled={draftMembers.length <= 1}
                          className="cursor-pointer flex items-center justify-center p-1.5 text-bt-muted hover:text-bt-red transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove slot"
                          aria-label={`Remove ${m.name || `slot ${idx + 1}`}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {renderVerificationStrip(m)}
                  </div>
                );
              })}
            </div>

            {/* Collapsible Optional Waitlist Challengers Section */}
            <div className="border border-bt-border bg-bt-bg/55">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => setWaitlistOpen((prev) => !prev)}
                  className="cursor-pointer inline-flex items-center gap-2 text-left"
                >
                  <span className="h-3.5 w-1 bg-bt-muted" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-bt-muted hover:text-white transition-colors">
                    Waitlist Challengers ({draftWaitlist.length}) — Optional
                  </span>
                  {waitlistOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-bt-muted" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-bt-muted" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => addMember(true)}
                  className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-elevated px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:border-bt-red transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Waitlist</span>
                </button>
              </div>

              {waitlistOpen && (
                <div className="border-t border-bt-border p-3.5 space-y-2">
                  {draftWaitlist.length === 0 ? (
                    <p className="py-2 text-center font-mono text-xs text-bt-muted">
                      Stage friends waiting for a seat to test swap value and
                      library delta in the Swap Simulator.
                    </p>
                  ) : (
                    <>
                      <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 pb-1 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                        <span className="sm:col-span-4">Display Name</span>
                        <span
                          className={
                            hasApiKey ? "sm:col-span-6" : "sm:col-span-7"
                          }
                        >
                          Steam URL, Vanity or SteamID64
                        </span>
                        <span
                          className={
                            hasApiKey
                              ? "sm:col-span-2 text-right pr-1"
                              : "sm:col-span-1 text-center"
                          }
                        >
                          {hasApiKey ? "Verify / Del" : "Del"}
                        </span>
                      </div>

                      {draftWaitlist.map((w, idx) => {
                        const v = verifications[w.id];
                        const isVerifying = v?.status === "loading";
                        return (
                          <div
                            key={w.id}
                            className="border border-bt-border bg-bt-elevated/80 p-2.5 transition-colors focus-within:border-bt-red/60"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={w.name}
                                onChange={(e) =>
                                  updateRow(true, w.id, {
                                    name: e.target.value,
                                  })
                                }
                                aria-label={`Waitlist challenger ${idx + 1} display name`}
                                placeholder="Auto-filled on verify"
                                className="sm:col-span-4 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                              />
                              <input
                                type="text"
                                value={w.steamUrlOrId}
                                onChange={(e) =>
                                  updateRow(true, w.id, {
                                    steamUrlOrId: e.target.value,
                                  })
                                }
                                aria-label={`Waitlist challenger ${idx + 1} Steam URL, vanity name, or SteamID64`}
                                placeholder="steamcommunity.com/id/... or 7656119..."
                                className={`${
                                  hasApiKey ? "sm:col-span-6" : "sm:col-span-7"
                                } border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none`}
                              />
                              <div
                                className={`${
                                  hasApiKey ? "sm:col-span-2" : "sm:col-span-1"
                                } flex items-center justify-end gap-1.5`}
                              >
                                {hasApiKey && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      verifyRow(w.id, w.steamUrlOrId, true)
                                    }
                                    disabled={
                                      !w.steamUrlOrId.trim() || isVerifying
                                    }
                                    title="Verify Steam profile & public game count"
                                    aria-label={`Verify ${w.name || `waitlist challenger ${idx + 1}`}`}
                                    className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-bg px-2 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-wider text-white hover:border-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                                  >
                                    {isVerifying ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-bt-red" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    )}
                                    <span>Verify</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDraftWaitlist((prev) =>
                                      prev.filter((x) => x.id !== w.id)
                                    );
                                    setVerifications((prev) => {
                                      const next = { ...prev };
                                      delete next[w.id];
                                      return next;
                                    });
                                  }}
                                  className="cursor-pointer flex items-center justify-center p-1.5 text-bt-muted hover:text-bt-red transition-colors"
                                  title="Remove waitlisted challenger"
                                  aria-label={`Remove ${w.name || `waitlist challenger ${idx + 1}`}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {renderVerificationStrip(w)}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bottom CTA Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-bt-border pt-4">
              <div className="font-mono text-xs text-bt-muted">
                {cleanActiveMembers.length > 0 ? (
                  <span>
                    <span className="font-semibold text-white">
                      {cleanActiveMembers.length}
                    </span>{" "}
                    valid active{" "}
                    {cleanActiveMembers.length === 1 ? "slot" : "slots"}
                    {cleanWaitlistMembers.length > 0
                      ? ` · ${cleanWaitlistMembers.length} waitlist`
                      : ""}
                    {` · ${STEAM_REGIONS[region].label}`}
                  </span>
                ) : (
                  <span>
                    Enter at least 1 Steam profile URL, vanity name, or
                    SteamID64
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={
                  cleanActiveMembers.length === 0 ||
                  !hasApiKey ||
                  loading ||
                  bulkBusy
                }
                className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-6 py-3 font-condensed text-sm font-bold uppercase tracking-[0.18em] text-white hover:bg-bt-red-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {loading ? "ANALYZING LIBRARIES..." : "ANALYZE STEAM FAMILY"}
                </span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
