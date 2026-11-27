"use client";

import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiscordSDK } from "@discord/embedded-app-sdk";
import { CommunityLinksCard } from "@/components/CommunityLinksCard";
import {
  authorizeDiscordActivity,
  type DiscordActivityAuthResult,
  isDiscordActivityEnvironment,
  openExternalUrl,
  patchDiscordActivityUrls,
} from "@/lib/discord-activity";
import { ContributionBoard } from "@/components/ContributionBoard";
import { FamilyLeaderboard } from "@/components/FamilyLeaderboard";
import { GameCheckerCard } from "@/components/GameCheckerCard";
import {
  FamilyLaunchpad,
  type SteamSessionUser,
} from "@/components/FamilyLaunchpad";
import { MemberEditorModal } from "@/components/MemberEditorModal";
import { MonthlyHistory } from "@/components/MonthlyHistory";
import { OverlapAndCatalog } from "@/components/OverlapAndCatalog";
import { RegionSelect } from "@/components/RegionSelect";
import { SaveFamilyModal } from "@/components/SaveFamilyModal";
import { SiteFooter } from "@/components/SiteFooter";
import { SwapSimulator } from "@/components/SwapSimulator";
import {
  HeaderThemeSwitcher,
  ThemeGalleryTab,
} from "@/components/ThemePicker";
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
  ChevronRight,
  Eye,
  FlaskConical,
  Grid3X3,
  Loader2,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

type TabId =
  | "board"
  | "overlap"
  | "simulator"
  | "history"
  | "checker"
  | "leaderboard"
  | "themes";

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
  {
    id: "checker",
    index: "05",
    label: "Game & Discount Checker",
    sectionTitle: "GAME & DISCOUNT CHECKER",
    icon: Search,
  },
  {
    id: "leaderboard",
    index: "06",
    label: "Family Leaderboard",
    sectionTitle: "FAMILY LEADERBOARD & AWARDS",
    icon: Trophy,
  },
  {
    id: "themes",
    index: "07",
    label: "Themes",
    sectionTitle: "THEMES & APPEARANCE",
    icon: Palette,
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

type AccountSavedFamily = SavedFamilyData & {
  ownerSteamId64?: string | null;
  userRole?: "owner" | "active" | "waitlist";
};

const REGION_STORAGE_KEY = "steamfam_preferred_region";
const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://steamft.com";

function parseSteamRegion(value: unknown): SteamRegion | null {
  if (typeof value === "string" && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return null;
}

function readStoredRegion(): SteamRegion | null {
  try {
    return parseSteamRegion(window.localStorage.getItem(REGION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredRegion(region: SteamRegion): void {
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    // Ignore storage errors in restricted iframes / private mode
  }
}

interface MeFamiliesResponse {
  user?: SteamSessionUser | null;
  preferredRegion?: SteamRegion | null;
  activeFamily?: AccountSavedFamily | null;
  waitlistedIn?: AccountSavedFamily[];
}

interface FamilyDashboardProps {
  initialFamily?: AccountSavedFamily;
  initialHasApiKey?: boolean;
  initialHasDatabase?: boolean;
}

export function FamilyDashboard({
  initialFamily,
  initialHasApiKey,
  initialHasDatabase,
}: FamilyDashboardProps) {
  const router = useRouter();
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
  const [activeSavedFamily, setActiveSavedFamily] =
    useState<AccountSavedFamily | null>(initialFamily ?? null);
  const [myActiveFamily, setMyActiveFamily] =
    useState<AccountSavedFamily | null>(null);
  const [waitlistedFamilies, setWaitlistedFamilies] = useState<
    AccountSavedFamily[]
  >([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [deletingFamily, setDeletingFamily] = useState(false);
  const [steamUser, setSteamUser] = useState<SteamSessionUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isDiscordActivity, setIsDiscordActivity] = useState(false);
  const [discordActivityLoading, setDiscordActivityLoading] = useState(false);
  const [discordUnlinked, setDiscordUnlinked] = useState<{
    username: string;
    linkToken: string;
  } | null>(null);

  const manualLaunchRef = useRef(false);
  const isPreviewModeRef = useRef(false);
  const discordSdkRef = useRef<DiscordSDK | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const hasActiveRoster = members.length > 0;
  const isOwner = !activeSavedFamily
    ? true
    : Boolean(
        steamUser &&
          (activeSavedFamily.userRole === "owner" ||
            activeSavedFamily.ownerSteamId64 === steamUser.steamId64)
      );

  const loadSavedFamily = useCallback(
    (fam: AccountSavedFamily, regionOverride?: SteamRegion | null) => {
      isPreviewModeRef.current = false;
      setIsPreviewMode(false);
      const effectiveRegion = regionOverride ?? fam.region;
      setActiveSavedFamily({ ...fam, region: effectiveRegion });
      setRegion(effectiveRegion);
      setMembers(fam.members);
      setWaitlist(fam.waitlist);
      setSnapshots(fam.snapshots ?? []);
      setActiveTab("board");
      setAnalysis(null);
      setActiveLibraries([]);
      setWaitlistLibraries([]);
      setError(null);
      setWarnings([]);
      setNotice(null);
      setLoading(fam.members.length > 0);
    },
    []
  );

  const enterPreviewSandbox = useCallback(() => {
    isPreviewModeRef.current = true;
    setIsPreviewMode(true);
    setActiveSavedFamily(null);
    setMembers([]);
    setWaitlist([]);
    setSnapshots([]);
    setAnalysis(null);
    setActiveLibraries([]);
    setWaitlistLibraries([]);
    setWarnings([]);
    setError(null);
    setNotice(null);
    setLoading(false);
    setActiveTab("board");
  }, []);

  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (typeof d.hasApiKey === "boolean") {
          setHasApiKey(d.hasApiKey);
        }
        if (typeof d.hasDatabase === "boolean") {
          setHasDatabase(d.hasDatabase);
        }
      })
      .catch(() => {});
  }, []);

  const persistRegionPreference = useCallback(
    (nextRegion: SteamRegion, opts?: { syncFamily?: boolean }) => {
      writeStoredRegion(nextRegion);

      if (steamUser) {
        fetch("/api/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region: nextRegion }),
        }).catch(() => {});
      }

      if (opts?.syncFamily !== false && activeSavedFamily && isOwner) {
        setActiveSavedFamily((prev) =>
          prev ? { ...prev, region: nextRegion } : prev
        );
        fetch(`/api/families/${encodeURIComponent(activeSavedFamily.slug)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region: nextRegion }),
        }).catch(() => {});
      }
    },
    [activeSavedFamily, isOwner, steamUser]
  );

  const applyMeFamiliesResponse = useCallback(
    (d: MeFamiliesResponse) => {
      setSteamUser(d?.user ?? null);
      setMyActiveFamily(d?.activeFamily ?? null);
      setWaitlistedFamilies(
        Array.isArray(d?.waitlistedIn) ? d.waitlistedIn : []
      );
      const acctRegion = parseSteamRegion(d?.preferredRegion);
      if (acctRegion) {
        writeStoredRegion(acctRegion);
        setRegion(acctRegion);
      }
      if (
        !initialFamily &&
        !isPreviewModeRef.current &&
        !manualLaunchRef.current &&
        d?.activeFamily
      ) {
        loadSavedFamily(d.activeFamily, acctRegion);
      }
    },
    [initialFamily, loadSavedFamily]
  );

  const syncDiscordActivitySession = useCallback(async (): Promise<DiscordActivityAuthResult | null> => {
    setDiscordActivityLoading(true);
    try {
      const { sdk, auth } = await authorizeDiscordActivity();
      discordSdkRef.current = sdk;
      if (auth.linked) {
        setDiscordUnlinked(null);
        const meRes = await fetch("/api/me/families");
        if (meRes.ok) {
          const meData = (await meRes.json()) as MeFamiliesResponse;
          applyMeFamiliesResponse(meData);
        }
      } else if (auth.linkToken) {
        setDiscordUnlinked({
          username:
            auth.discordUser?.globalName ||
            auth.discordUser?.username ||
            "Discord User",
          linkToken: auth.linkToken,
        });
      }
      return auth;
    } catch {
      // Non-fatal: user can still use Preview Sandbox or manual launch
      return null;
    } finally {
      setDiscordActivityLoading(false);
    }
  }, [applyMeFamiliesResponse]);

  const handleDiscordSteamSignIn = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      if (!isDiscordActivity) return;
      e.preventDefault();

      if (discordUnlinked?.linkToken) {
        await openExternalUrl(
          `${PUBLIC_SITE_URL}/api/auth/steam?discord_link=${encodeURIComponent(
            discordUnlinked.linkToken
          )}`,
          discordSdkRef.current
        );
        return;
      }

      const auth = await syncDiscordActivitySession();
      if (auth && !auth.linked && auth.linkToken) {
        await openExternalUrl(
          `${PUBLIC_SITE_URL}/api/auth/steam?discord_link=${encodeURIComponent(
            auth.linkToken
          )}`,
          discordSdkRef.current
        );
      }
    },
    [discordUnlinked, isDiscordActivity, syncDiscordActivitySession]
  );

  useEffect(() => {
    let cancelled = false;
    if (!initialFamily) {
      const stored = readStoredRegion();
      if (stored) {
        queueMicrotask(() => {
          if (!cancelled) setRegion(stored);
        });
      }
    }
    const inDiscord = isDiscordActivityEnvironment();
    if (inDiscord) {
      void patchDiscordActivityUrls();
      queueMicrotask(() => {
        if (!cancelled) setIsDiscordActivity(true);
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("authError") === "steam_failed") {
      params.delete("authError");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
      queueMicrotask(() => {
        if (!cancelled) {
          setError("Steam sign-in could not be verified. Please try again.");
        }
      });
    }

    fetch("/api/me/families")
      .then((r) =>
        r.ok
          ? r.json()
          : { user: null, activeFamily: null, waitlistedIn: [] }
      )
      .then((d: MeFamiliesResponse) => {
        if (cancelled) return;
        applyMeFamiliesResponse(d);
        if (inDiscord && !d?.user) {
          void syncDiscordActivitySession();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialFamily, applyMeFamiliesResponse, syncDiscordActivitySession]);

  const triggerRefresh = useCallback(() => {
    if (members.length === 0) return;
    setLoading(true);
    setError(null);
    setRefreshNonce((prev) => prev + 1);
  }, [members.length]);

  useEffect(() => {
    if (members.length === 0) return;

    const controller = new AbortController();
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
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as AnalyzeResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setError(null);
        setAnalysis(data.analysis);
        setActiveLibraries(data.activeLibraries);
        setWaitlistLibraries(data.waitlistLibraries);
        setWarnings(data.warnings ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setWarnings([]);
        setError(
          err instanceof Error ? err.message : "Failed to load family data"
        );
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [region, includeExcluded, members, waitlist, refreshNonce]);

  const handleLaunchFamily = ({
    region: nextRegion,
    members: nextMembers,
    waitlist: nextWaitlist,
  }: {
    region: SteamRegion;
    members: FamilyMemberInput[];
    waitlist: FamilyMemberInput[];
  }) => {
    manualLaunchRef.current = true;
    isPreviewModeRef.current = true;
    setIsPreviewMode(true);
    setActiveSavedFamily(null);
    setSnapshots([]);
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
    enterPreviewSandbox();
  };

  const handleBrandClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (initialFamily) return;
    e.preventDefault();

    if (activeSavedFamily) {
      setActiveTab("board");
      return;
    }

    const fallbackSaved = myActiveFamily ?? waitlistedFamilies[0] ?? null;
    if (fallbackSaved) {
      loadSavedFamily(fallbackSaved);
      return;
    }

    if (hasActiveRoster) {
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

    if (!activeSavedFamily || !isOwner) return;

    try {
      const res = await fetch(`/api/families/${activeSavedFamily.slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          region,
          members: nextMembers,
          waitlist: nextWaitlist,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to persist member edits");
      }
      const updatedFamily: AccountSavedFamily = {
        ...activeSavedFamily,
        region,
        members: nextMembers,
        waitlist: nextWaitlist,
      };
      setActiveSavedFamily(updatedFamily);
      setMyActiveFamily((prev) =>
        prev?.slug === updatedFamily.slug ? updatedFamily : prev
      );
      showNotice("Saved member changes to group.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save member edits"
      );
    }
  };

  const handleSaveSnapshot = async (monthKey: string) => {
    if (!activeSavedFamily || !analysis || !isOwner) return;

    const res = await fetch(
      `/api/families/${activeSavedFamily.slug}/snapshots`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshotMonth: monthKey,
          analysis,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to record snapshot");
      return;
    }

    setSnapshots((prev) => {
      const filtered = prev.filter((s) => s.snapshotMonth !== data.snapshotMonth);
      return [data as MonthlySnapshotRecord, ...filtered].sort((a, b) =>
        b.snapshotMonth.localeCompare(a.snapshotMonth)
      );
    });
    showNotice(`Recorded ${monthKey} snapshot.`);
  };

  const handleDeleteFamily = async () => {
    if (!activeSavedFamily || !isOwner || deletingFamily) return;
    if (
      !window.confirm(
        `Delete "${activeSavedFamily.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingFamily(true);
    setError(null);
    try {
      const res = await fetch(`/api/families/${activeSavedFamily.slug}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete family");
      }
      const deletedSlug = activeSavedFamily.slug;
      setMyActiveFamily((prev) => (prev?.slug === deletedSlug ? null : prev));
      setWaitlistedFamilies((prev) =>
        prev.filter((fam) => fam.slug !== deletedSlug)
      );
      enterPreviewSandbox();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete family"
      );
    } finally {
      setDeletingFamily(false);
    }
  };

  const handleSteamSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/steam/logout", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Sign-out failed (${res.status})`);
      }
      setSteamUser(null);
      setMyActiveFamily(null);
      setWaitlistedFamilies([]);
      if (activeSavedFamily) {
        if (initialFamily) {
          router.push("/");
          return;
        }
        enterPreviewSandbox();
      }
    } catch {
      setError("Failed to sign out of Steam session. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const activeNav =
    NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const activeRegion = STEAM_REGIONS[region];
  const upNextMember = analysis?.fairness?.upNextMemberId
    ? analysis.fairness.members.find(
        (m) => m.memberId === analysis.fairness.upNextMemberId
      ) ?? analysis.fairness.members.find((m) => m.isUpNext)
    : undefined;

  const steamAuthControl = steamUser ? (
    <div className="border border-bt-border bg-bt-surface px-2.5 py-1 flex items-center gap-2">
      {steamUser.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={steamUser.avatarUrl}
          alt={steamUser.personaName}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 object-cover border border-bt-border"
        />
      ) : (
        <span className="h-6 w-6 shrink-0 border border-bt-border bg-bt-bg flex items-center justify-center font-mono text-[10px] text-bt-muted">
          {(steamUser.personaName || "ST").slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="font-condensed font-bold uppercase tracking-wide text-xs text-white max-w-[140px] truncate">
        {steamUser.personaName}
      </span>
      <button
        type="button"
        onClick={handleSteamSignOut}
        disabled={signingOut}
        title="Sign out of Steam"
        aria-label="Sign out of Steam"
        className="cursor-pointer inline-flex items-center gap-1 border-l border-bt-border pl-2 ml-0.5 font-mono text-[10px] uppercase tracking-wider text-bt-muted hover:text-bt-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
      >
        {signingOut ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  ) : hasApiKey ? (
    <a
      href="/api/auth/steam"
      onClick={(e) => {
        void handleDiscordSteamSignIn(e);
      }}
      className="inline-flex items-center gap-1.5 border border-bt-border bg-bt-surface hover:border-bt-red text-white font-condensed font-bold uppercase tracking-wider text-xs px-3 py-1.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
    >
      <LogIn className="h-3.5 w-3.5 text-bt-red shrink-0" />
      <span>Sign in with Steam</span>
    </a>
  ) : null;

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
                initialFamily
                  ? "SteamFamTrack Home"
                  : activeSavedFamily
                    ? `Open ${activeSavedFamily.name} Contribution Board`
                    : myActiveFamily || waitlistedFamilies.length > 0
                      ? "Return to your saved Steam Family"
                      : hasActiveRoster
                        ? "Return to SteamFamTrack Launchpad"
                        : "SteamFamTrack Home"
              }
              className="cursor-pointer shrink-0 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                fill="none"
                aria-hidden="true"
                className="h-9 w-9 shrink-0"
              >
                <polygon
                  points="2,2 50,2 62,14 62,62 2,62"
                  fill="var(--bt-bg)"
                  stroke="var(--bt-red)"
                  strokeWidth="3"
                />
                <polygon points="48,2 62,16 62,2 48,2" fill="var(--bt-red)" />
                <circle
                  cx="40"
                  cy="22"
                  r="7"
                  stroke="var(--bt-red)"
                  strokeWidth="3.2"
                />
                <path
                  d="M31 35.5C33.5 32.5 36.8 31 40 31C46.6 31 52 36.2 52 43V45H35"
                  stroke="var(--bt-red)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="24"
                  cy="27"
                  r="7.5"
                  fill="var(--bt-bg)"
                  stroke="var(--bt-ink)"
                  strokeWidth="3.4"
                />
                <path
                  d="M11 49V46C11 38.8 16.8 34.5 24 34.5C31.2 34.5 37 38.8 37 46V49H11Z"
                  fill="var(--bt-bg)"
                  stroke="var(--bt-ink)"
                  strokeWidth="3.4"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/"
                  onClick={handleBrandClick}
                  className="cursor-pointer min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  <h1 className="font-display text-2xl sm:text-3xl leading-none tracking-wider uppercase text-white hover:text-white/90 transition-colors truncate">
                    {activeSavedFamily ? activeSavedFamily.name : "STEAMFAMTRACK"}
                  </h1>
                </Link>
                {isDiscordActivity && (
                  <span className="p5-tag px-2.5 py-0.5 border bg-[#5865F2]/20 border-[#5865F2]/60 text-[#C7CEFF]">
                    <span className="p5-unskew inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-widest">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5865F2]" />
                      DISCORD ACTIVITY
                    </span>
                  </span>
                )}
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
                {hasActiveRoster && !activeSavedFamily && (
                  <span className="p5-tag px-2.5 py-0.5 border bg-amber-950/60 border-amber-500/50 text-amber-300">
                    <span className="p5-unskew inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-widest">
                      <FlaskConical className="h-3 w-3" />
                      PREVIEW SANDBOX
                    </span>
                  </span>
                )}
                {activeSavedFamily && !isOwner && (
                  <span className="p5-tag px-2.5 py-0.5 border bg-bt-elevated border-bt-border text-bt-muted">
                    <span className="p5-unskew inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-widest">
                      <Eye className="h-3 w-3 text-bt-red" />
                      {activeSavedFamily.userRole === "waitlist"
                        ? "WAITLISTED"
                        : "VIEW ONLY"}
                    </span>
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-bt-muted mt-1 truncate">
                {activeSavedFamily
                  ? `/f/${activeSavedFamily.slug}`
                  : "BELTEEZ STUDIO TELEMETRY"}
              </p>
            </div>
          </div>

          {/* Right Command Bar & Steam Session Auth */}
          <div className="flex flex-wrap items-center gap-2.5">
            {hasActiveRoster ? (
              <div className="flex flex-wrap items-center gap-2 bg-bt-surface border border-bt-border p-1.5">
                {/* Region Picker */}
                <RegionSelect
                  value={region}
                  onChange={(nextRegion) => {
                    setLoading(true);
                    setRegion(nextRegion);
                    persistRegionPreference(nextRegion, { syncFamily: true });
                  }}
                  ariaLabel="Pricing region"
                  compact
                />

                {/* Edit Roster (Owner or Preview Sandbox) */}
                {isOwner && (
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
                )}

                {/* Save to Steam Account (Preview Sandbox Only) */}
                {!activeSavedFamily && hasDatabase && (
                  <button
                    type="button"
                    onClick={() => setSaveModalOpen(true)}
                    className="cursor-pointer inline-flex items-center gap-1.5 bg-bt-bg border border-bt-red/50 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red/15 hover:border-bt-red transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                  >
                    <Save className="h-3.5 w-3.5 text-bt-red" />
                    Save to Steam Account
                  </button>
                )}

                {/* Primary Refresh CTA */}
                <button
                  type="button"
                  onClick={triggerRefresh}
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
              <div className="hidden md:flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-bt-dim">
                <span className="h-1.5 w-1.5 bg-bt-red" />
                <span>MAX 6 SLOTS // REAL-TIME STEAM PRICING</span>
              </div>
            )}

            <HeaderThemeSwitcher
              onOpenThemesTab={
                hasActiveRoster ? () => setActiveTab("themes") : undefined
              }
            />

            {steamAuthControl}
          </div>
        </div>
      </header>

      {/* Main Content: Launchpad vs. Active 2-Column Workspace */}
      <main className="relative z-10 mx-auto w-full max-w-[1720px] flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {isDiscordActivity && discordUnlinked && !steamUser && (
          <div className="mb-6 border border-[#5865F2]/60 bg-bt-surface p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9AA4FF]">
                DISCORD ACTIVITY // LINK STEAM ACCOUNT
              </div>
              <p className="text-sm text-bt-muted">
                Signed in as{" "}
                <span className="text-white font-semibold">
                  {discordUnlinked.username}
                </span>
                . Verify your Steam account once to auto-load your family inside
                Discord.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void openExternalUrl(
                    `${PUBLIC_SITE_URL}/api/auth/steam?discord_link=${encodeURIComponent(
                      discordUnlinked.linkToken
                    )}`,
                    discordSdkRef.current
                  );
                }}
                className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-condensed font-bold uppercase tracking-wider text-xs px-3.5 py-2 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5 shrink-0" />
                <span>Verify &amp; Link Steam</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              </button>
              <button
                type="button"
                disabled={discordActivityLoading}
                onClick={() => void syncDiscordActivitySession()}
                className="cursor-pointer inline-flex items-center gap-1.5 border border-bt-border bg-bt-bg hover:border-bt-red text-white font-condensed font-bold uppercase tracking-wider text-xs px-3 py-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    discordActivityLoading ? "animate-spin" : ""
                  }`}
                />
                <span>I&apos;ve Linked — Refresh</span>
              </button>
            </div>
          </div>
        )}
        {!hasActiveRoster ? (
          <FamilyLaunchpad
            initialRegion={region}
            onRegionChange={(nextRegion) => {
              setRegion(nextRegion);
              persistRegionPreference(nextRegion, { syncFamily: false });
            }}
            onSteamSignIn={
              isDiscordActivity
                ? (e) => {
                    void handleDiscordSteamSignIn(e);
                  }
                : undefined
            }
            hasApiKey={hasApiKey}
            steamUser={steamUser}
            savedFamilies={[
              ...(myActiveFamily
                ? [
                    {
                      slug: myActiveFamily.slug,
                      name: myActiveFamily.name,
                      role: "active" as const,
                    },
                  ]
                : []),
              ...waitlistedFamilies.map((f) => ({
                slug: f.slug,
                name: f.name,
                role: "waitlist" as const,
              })),
            ]}
            onSelectSavedFamily={(slug) => {
              const target =
                myActiveFamily?.slug === slug
                  ? myActiveFamily
                  : waitlistedFamilies.find((f) => f.slug === slug);
              if (target) loadSavedFamily(target);
            }}
            recentFamilies={[]}
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
                    {activeNav.index}/{String(NAV_ITEMS.length).padStart(2, "0")}
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
                        className={`h-3.5 w-3.5 transition-transform ${
                          includeExcluded
                            ? "translate-x-[18px] bg-bt-on-accent"
                            : "translate-x-0 bg-bt-muted"
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

              {/* 4. Your Families & Preview Sandbox Switcher */}
              {steamUser &&
                (myActiveFamily || waitlistedFamilies.length > 0) && (
                  <div className="bg-bt-surface border border-bt-border p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-bt-border/80">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
                        <Bookmark className="h-3 w-3 text-bt-red" />
                        YOUR FAMILIES
                      </span>
                      <span className="font-mono text-[10px] text-bt-dim">
                        {(myActiveFamily ? 1 : 0) + waitlistedFamilies.length}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {myActiveFamily && (
                        <button
                          type="button"
                          onClick={() => loadSavedFamily(myActiveFamily)}
                          aria-current={
                            !isPreviewMode &&
                            activeSavedFamily?.slug === myActiveFamily.slug
                              ? "page"
                              : undefined
                          }
                          className={`cursor-pointer w-full text-left group flex items-center justify-between gap-2 px-2.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                            !isPreviewMode &&
                            activeSavedFamily?.slug === myActiveFamily.slug
                              ? "bg-bt-elevated border-l-[3px] border-l-bt-red border-y border-r border-y-bt-border border-r-bt-border text-white"
                              : "bg-bt-bg/70 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/60 text-bt-muted hover:text-white"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
                              {myActiveFamily.name}
                            </span>
                            <span className="block font-mono text-[10px] text-bt-dim truncate">
                              /f/{myActiveFamily.slug}
                            </span>
                          </span>
                          <span className="shrink-0 bg-bt-red/15 border border-bt-red/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-bt-red font-medium">
                            ACTIVE
                          </span>
                        </button>
                      )}

                      {waitlistedFamilies.map((fam) => {
                        const isCurrent =
                          !isPreviewMode &&
                          activeSavedFamily?.slug === fam.slug;
                        return (
                          <button
                            key={fam.slug}
                            type="button"
                            onClick={() => loadSavedFamily(fam)}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`cursor-pointer w-full text-left group flex items-center justify-between gap-2 px-2.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
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
                            <span className="shrink-0 bg-bt-bg border border-bt-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-bt-muted font-medium">
                              WAITLIST
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={enterPreviewSandbox}
                        className={`cursor-pointer w-full text-left group flex items-center justify-between gap-2 px-2.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                          !activeSavedFamily
                            ? "bg-bt-elevated border-l-[3px] border-l-amber-400 border-y border-r border-y-bt-border border-r-bt-border text-white"
                            : "bg-bt-bg/70 hover:bg-bt-elevated border border-bt-border/80 hover:border-amber-400/60 text-bt-muted hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span className="font-condensed text-xs font-bold uppercase tracking-wider truncate">
                            Preview Sandbox
                          </span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-bt-dim group-hover:text-amber-400 transition-colors" />
                      </button>
                    </div>
                  </div>
                )}

              {/* 5. Owner Delete Family / Preview Reset */}
              {activeSavedFamily && isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteFamily}
                  disabled={deletingFamily}
                  className="cursor-pointer w-full inline-flex items-center justify-center gap-2 bg-bt-surface border border-bt-border hover:border-bt-red/70 hover:bg-bt-red/10 px-3.5 py-2 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted hover:text-bt-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  {deletingFamily ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-bt-red" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-bt-red" />
                  )}
                  <span>Delete Family</span>
                </button>
              )}

              {!activeSavedFamily && (
                <button
                  type="button"
                  onClick={handleResetToLaunchpad}
                  className="cursor-pointer w-full inline-flex items-center justify-center gap-2 bg-bt-surface border border-bt-border hover:border-bt-red/70 hover:bg-bt-elevated px-3.5 py-2.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-bt-red" />
                  <span>Start New Family</span>
                </button>
              )}

              {/* 6. Community & Project Links */}
              <CommunityLinksCard />

              {/* 7. Minimal Studio Signature Footer */}
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
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 bg-bt-elevated border border-bt-red/60 hover:bg-bt-red px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Edit Roster
                    </button>
                  )}
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

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setEditorOpen(true)}
                        className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 bg-bt-elevated border border-amber-400/50 hover:border-amber-300 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-amber-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      >
                        <Users className="h-3.5 w-3.5 text-amber-400" />
                        Edit Roster
                      </button>
                    )}
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
              {activeTab === "themes" ? (
                <ThemeGalleryTab
                  onThemeApplied={(theme) =>
                    showNotice(`Theme switched to ${theme.name}.`)
                  }
                />
              ) : loading && !analysis ? (
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
                      <OverlapAndCatalog
                        key={`${activeSavedFamily?.slug ?? "preview"}-${region}-${includeExcluded}`}
                        analysis={analysis}
                      />
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
                        slug={activeSavedFamily?.slug}
                        analysis={analysis}
                        snapshots={snapshots}
                        hasDatabase={hasDatabase}
                        onSaveSnapshot={
                          activeSavedFamily && isOwner
                            ? handleSaveSnapshot
                            : undefined
                        }
                        onOpenSaveModal={
                          !activeSavedFamily
                            ? () => setSaveModalOpen(true)
                            : undefined
                        }
                      />
                    )}
                    {activeTab === "checker" && (
                      <GameCheckerCard
                        activeLibraries={activeLibraries}
                        waitlistLibraries={waitlistLibraries}
                        region={region}
                        fairness={analysis.fairness}
                        currentUserName={steamUser?.personaName}
                      />
                    )}
                    {activeTab === "leaderboard" && (
                      <FamilyLeaderboard
                        analysis={analysis}
                        activeLibraries={activeLibraries}
                        waitlistLibraries={waitlistLibraries}
                        region={region}
                        includeExcluded={includeExcluded}
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

      <SiteFooter />

      <MemberEditorModal
        key={`${editorOpen}-${members.length}-${waitlist.length}`}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        members={members}
        waitlist={waitlist}
        hasApiKey={hasApiKey}
        steamUser={steamUser}
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
        steamUser={steamUser}
        onSteamSignIn={
          isDiscordActivity
            ? (e) => {
                void handleDiscordSteamSignIn(e);
              }
            : undefined
        }
        onSaved={(fam: AccountSavedFamily) => {
          isPreviewModeRef.current = false;
          setIsPreviewMode(false);
          setActiveSavedFamily(fam);
          setMyActiveFamily(fam);
          setSnapshots(fam.snapshots ?? []);
          setSaveModalOpen(false);
          showNotice(`Saved "${fam.name}" to your Steam account.`);
        }}
      />
    </div>
  );
}
