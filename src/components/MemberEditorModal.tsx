"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FamilyMemberInput } from "@/lib/types";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Info,
  Loader2,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";

export interface SteamSessionUser {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface MemberEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMemberInput[];
  waitlist: FamilyMemberInput[];
  hasApiKey?: boolean;
  steamUser?: SteamSessionUser | null;
  onSave: (
    members: FamilyMemberInput[],
    waitlist: FamilyMemberInput[]
  ) => void;
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
  ok?: boolean;
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

interface SteamFriendEntry {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  friendSince?: number;
}

interface FriendsApiResponse {
  steamId64?: string;
  isPrivate?: boolean;
  friends?: SteamFriendEntry[];
  hint?: string;
  error?: string;
}

function isPlaceholderName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /^(New Member|Waitlist Friend|Member \d+|Waitlist \d+)$/i.test(
    trimmed
  );
}

function extractSteamId64(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (/^\d{17}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  return match?.[1] ?? null;
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

export function MemberEditorModal({
  isOpen,
  onClose,
  members,
  waitlist,
  hasApiKey = false,
  steamUser = null,
  onSave,
}: MemberEditorModalProps) {
  const [draftMembers, setDraftMembers] = useState<FamilyMemberInput[]>(() => {
    if (members.length > 0) {
      return members;
    }
    return [
      {
        id: "m-empty-1",
        name: "",
        steamUrlOrId: "",
        joinDate: "",
        isWaitlist: false,
      },
    ];
  });

  const [draftWaitlist, setDraftWaitlist] =
    useState<FamilyMemberInput[]>(() => waitlist);

  const [showFreshBanner, setShowFreshBanner] = useState<boolean>(false);
  const [bulkOpen, setBulkOpen] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [verifications, setVerifications] = useState<
    Record<string, RowVerification>
  >({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pick From Friends Drawer state
  const [friendsOpen, setFriendsOpen] = useState<boolean>(false);
  const [friends, setFriends] = useState<SteamFriendEntry[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState<boolean>(false);
  const [friendsLoading, setFriendsLoading] = useState<boolean>(false);
  const [friendsIsPrivate, setFriendsIsPrivate] = useState<boolean>(false);
  const [friendsHint, setFriendsHint] = useState<string | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState<string>("");
  const [pickerMode, setPickerMode] = useState<"active" | "waitlist">("active");
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);

  const idCounterRef = useRef<number>(1);
  const lastVerifiedInputsRef = useRef<Record<string, string>>({});

  const nextRowId = (prefix: "m" | "w") => {
    idCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${idCounterRef.current}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const friendPlacementMap = useMemo(() => {
    const map = new Map<
      string,
      { placement: "active" | "waitlist"; rowId: string }
    >();
    for (const m of draftMembers) {
      const sid =
        verifications[m.id]?.steamId64 || extractSteamId64(m.steamUrlOrId);
      if (sid) {
        map.set(sid, { placement: "active", rowId: m.id });
      }
    }
    for (const w of draftWaitlist) {
      const sid =
        verifications[w.id]?.steamId64 || extractSteamId64(w.steamUrlOrId);
      if (sid && !map.has(sid)) {
        map.set(sid, { placement: "waitlist", rowId: w.id });
      }
    }
    return map;
  }, [draftMembers, draftWaitlist, verifications]);

  const filteredFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.personaName.toLowerCase().includes(q) || f.steamId64.includes(q)
    );
  }, [friends, friendSearch]);

  const selectedFriendsCount = useMemo(
    () => friends.filter((f) => friendPlacementMap.has(f.steamId64)).length,
    [friends, friendPlacementMap]
  );

  if (!isOpen) return null;

  const updateRow = (
    isWait: boolean,
    id: string,
    patch: Partial<FamilyMemberInput>
  ) => {
    setValidationError(null);
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
      if (!patch.steamUrlOrId.trim()) {
        delete lastVerifiedInputsRef.current[id];
      }
      setVerifications((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addMember = (isWait: boolean) => {
    setValidationError(null);
    const today = new Date().toISOString().slice(0, 10);
    const newItem: FamilyMemberInput = {
      id: nextRowId(isWait ? "w" : "m"),
      name: "",
      steamUrlOrId: "",
      joinDate: isWait ? undefined : today,
      isWaitlist: isWait,
    };
    if (isWait) {
      setDraftWaitlist((prev) => [...prev, newItem]);
    } else if (draftMembers.length < 6) {
      setDraftMembers((prev) => [...prev, newItem]);
    }
  };

  const handleStartFresh = () => {
    const today = new Date().toISOString().slice(0, 10);
    lastVerifiedInputsRef.current = {};
    setDraftMembers([
      {
        id: nextRowId("m"),
        name: "",
        steamUrlOrId: "",
        joinDate: today,
        isWaitlist: false,
      },
    ]);
    setDraftWaitlist([]);
    setVerifications({});
    setBulkText("");
    setValidationError(null);
    setPickerNotice(null);
    setShowFreshBanner(true);
  };

  const verifyRow = async (
    rowId: string,
    steamUrlOrId: string,
    isWait: boolean
  ) => {
    const input = steamUrlOrId.trim();
    if (!input || !hasApiKey) return;

    lastVerifiedInputsRef.current[rowId] = input;
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
      if (lastVerifiedInputsRef.current[rowId] !== input) return;

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
      if (lastVerifiedInputsRef.current[rowId] !== input) return;
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

  const maybeAutoVerify = (
    rowId: string,
    rawValue: string,
    isWait: boolean
  ) => {
    if (!hasApiKey) return;
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    if (lastVerifiedInputsRef.current[rowId] === trimmed) return;
    void verifyRow(rowId, trimmed, isWait);
  };

  const fetchSignedInFriends = async () => {
    if (!steamUser || !hasApiKey) return;
    setFriendsLoading(true);
    setFriendsError(null);
    setPickerNotice(null);
    try {
      const res = await fetch("/api/steam/friends", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as FriendsApiResponse;
      if (!res.ok || data.error) {
        setFriendsError(
          data.error ?? `Could not load Steam friends (${res.status})`
        );
        return;
      }
      setFriendsIsPrivate(Boolean(data.isPrivate));
      setFriendsHint(data.hint ?? null);
      setFriends(Array.isArray(data.friends) ? data.friends : []);
      setFriendsLoaded(true);
    } catch (err) {
      setFriendsError(
        err instanceof Error
          ? err.message
          : "Network error while loading Steam friends"
      );
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleToggleFriendsDrawer = () => {
    const nextOpen = !friendsOpen;
    setFriendsOpen(nextOpen);
    if (nextOpen && !friendsLoaded && !friendsLoading) {
      void fetchSignedInFriends();
    }
  };

  const toggleFriendSelection = (friend: SteamFriendEntry) => {
    setValidationError(null);
    setPickerNotice(null);

    const existing = friendPlacementMap.get(friend.steamId64);
    if (existing) {
      delete lastVerifiedInputsRef.current[existing.rowId];
      setVerifications((prev) => {
        if (!prev[existing.rowId]) return prev;
        const next = { ...prev };
        delete next[existing.rowId];
        return next;
      });

      if (existing.placement === "active") {
        setDraftMembers((prev) => {
          const remaining = prev.filter((m) => m.id !== existing.rowId);
          if (remaining.length === 0) {
            return [
              {
                id: nextRowId("m"),
                name: "",
                steamUrlOrId: "",
                joinDate: "",
                isWaitlist: false,
              },
            ];
          }
          return remaining;
        });
      } else {
        setDraftWaitlist((prev) =>
          prev.filter((w) => w.id !== existing.rowId)
        );
      }
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (pickerMode === "active") {
      const emptySlot = draftMembers.find((m) => !m.steamUrlOrId.trim());
      if (emptySlot) {
        setDraftMembers((prev) =>
          prev.map((m) =>
            m.id === emptySlot.id
              ? {
                  ...m,
                  name: friend.personaName,
                  steamUrlOrId: friend.steamId64,
                  joinDate: m.joinDate || today,
                }
              : m
          )
        );
        if (hasApiKey) {
          void verifyRow(emptySlot.id, friend.steamId64, false);
        }
        return;
      }

      if (draftMembers.length >= 6) {
        setPickerNotice(
          "All 6 active slots are filled — switch to Add to Waitlist or click a selected friend to remove."
        );
        return;
      }

      const newId = nextRowId("m");
      setDraftMembers((prev) => [
        ...prev,
        {
          id: newId,
          name: friend.personaName,
          steamUrlOrId: friend.steamId64,
          joinDate: today,
          isWaitlist: false,
        },
      ]);
      if (hasApiKey) {
        void verifyRow(newId, friend.steamId64, false);
      }
      return;
    }

    const emptyWaitSlot = draftWaitlist.find((w) => !w.steamUrlOrId.trim());
    if (emptyWaitSlot) {
      setDraftWaitlist((prev) =>
        prev.map((w) =>
          w.id === emptyWaitSlot.id
            ? {
                ...w,
                name: friend.personaName,
                steamUrlOrId: friend.steamId64,
              }
            : w
        )
      );
      if (hasApiKey) {
        void verifyRow(emptyWaitSlot.id, friend.steamId64, true);
      }
      return;
    }

    const newWaitId = nextRowId("w");
    setDraftWaitlist((prev) => [
      ...prev,
      {
        id: newWaitId,
        name: friend.personaName,
        steamUrlOrId: friend.steamId64,
        isWaitlist: true,
      },
    ]);
    if (hasApiKey) {
      void verifyRow(newWaitId, friend.steamId64, true);
    }
  };

  const handleBulkImport = async () => {
    const lines = parseBulkLines(bulkText).slice(0, 6);
    if (lines.length === 0) return;

    setValidationError(null);
    const today = new Date().toISOString().slice(0, 10);
    const importedRows: FamilyMemberInput[] = lines.map((line) => ({
      id: nextRowId("m"),
      name: "",
      steamUrlOrId: line,
      joinDate: today,
      isWaitlist: false,
    }));

    lastVerifiedInputsRef.current = {};
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

  const cleanActivePreview = draftMembers
    .filter((m) => m.steamUrlOrId.trim().length > 0)
    .map((m, idx) => ({
      ...m,
      name:
        m.name.trim() ||
        verifications[m.id]?.personaName ||
        deriveFallbackName(m.steamUrlOrId, idx, false),
      steamUrlOrId: m.steamUrlOrId.trim(),
      isWaitlist: false,
    }));

  const cleanWaitlistPreview = draftWaitlist
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
  const verifiableActiveCount = cleanActivePreview.length;

  const handleSubmit = () => {
    if (cleanActivePreview.length === 0) {
      setValidationError(
        "Add at least one Steam profile URL, vanity name, or SteamID64 to analyze."
      );
      return;
    }
    onSave(cleanActivePreview, cleanWaitlistPreview);
    onClose();
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4"
    >
      {/* Outer modal shell ONLY uses .p5-frame */}
      <div className="p5-frame w-full max-w-3xl bg-bt-red/70 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        <div className="bg-bt-surface flex flex-col max-h-[85vh] overflow-hidden">
          <div className="h-[2px] w-full bg-bt-red shrink-0" />

          {/* Modal Header */}
          <div className="shrink-0 border-b border-bt-border px-5 sm:px-6 py-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2
                      id="member-editor-title"
                      className="font-display text-2xl tracking-wider uppercase text-white leading-none"
                    >
                      Steam Family Roster Builder
                    </h2>
                    {hasApiKey && (
                      <span className="p5-tag bg-emerald-950/80 border border-emerald-500/45 px-2 py-0.5">
                        <span className="p5-unskew inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                          <Radio className="h-2.5 w-2.5" />
                          LIVE VERIFY READY
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-bt-muted">
                    Up to 6 active Steam Family slots. Paste profile URLs,
                    vanity names, or SteamID64s and set join dates to track
                    1-year slot unlocks.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="cursor-pointer shrink-0 border border-bt-border bg-bt-elevated p-1.5 text-bt-muted hover:border-bt-red hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Header Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {hasApiKey && steamUser && (
                  <button
                    type="button"
                    onClick={handleToggleFriendsDrawer}
                    className={`cursor-pointer inline-flex items-center gap-1.5 border px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                      friendsOpen
                        ? "border-bt-red bg-bt-red/15 text-white"
                        : "border-bt-border bg-bt-elevated text-white hover:border-bt-red"
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5 text-bt-red" />
                    <span>
                      Pick From Friends
                      {friendsLoaded && !friendsIsPrivate
                        ? ` (${friends.length})`
                        : ""}
                    </span>
                    {friendsOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 text-bt-muted" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-bt-muted" />
                    )}
                  </button>
                )}

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

                {hasApiKey && verifiableActiveCount > 0 && (
                  <button
                    type="button"
                    onClick={handleVerifyAllActive}
                    disabled={bulkBusy}
                    className="cursor-pointer inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-emerald-200 hover:border-emerald-400 hover:bg-emerald-950/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>Verify All ({verifiableActiveCount})</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartFresh}
                className="cursor-pointer inline-flex items-center gap-1.5 border border-bt-red/45 bg-bt-bg px-3 py-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-red hover:bg-bt-red hover:text-white transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Start Fresh (Clear All)</span>
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 overflow-y-auto tier-rail p-5 sm:p-6 space-y-5">
            {/* Start Fresh Guidance Banner */}
            {showFreshBanner && (
              <div className="flex items-start gap-2.5 border border-bt-red/35 border-l-4 border-l-bt-red bg-bt-red/10 px-3.5 py-2.5">
                <Info className="h-4 w-4 text-bt-red shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-white/90 leading-relaxed">
                  Paste your Steam Family profile URLs, vanity names, or
                  SteamID64s below. Steam Game Details must be Public.
                </p>
              </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div
                role="alert"
                className="flex items-center gap-2 border border-bt-red/50 border-l-4 border-l-bt-red bg-bt-red/15 px-3.5 py-2.5 font-mono text-xs text-white"
              >
                <XCircle className="h-4 w-4 text-bt-red shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Collapsible Pick From Friends Drawer */}
            {hasApiKey && steamUser && friendsOpen && (
              <div className="border border-bt-red/40 bg-bt-elevated/90 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {steamUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={steamUser.avatarUrl}
                        alt={steamUser.personaName}
                        className="h-6 w-6 shrink-0 object-cover border border-bt-red/60"
                      />
                    ) : (
                      <UserPlus className="h-4 w-4 text-bt-red shrink-0" />
                    )}
                    <span className="truncate font-condensed text-xs font-bold uppercase tracking-[0.18em] text-white">
                      Steam Friends — {steamUser.personaName}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={fetchSignedInFriends}
                    disabled={friendsLoading}
                    title="Refresh Steam friends list"
                    className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-bg px-2.5 py-1 font-condensed text-[11px] font-bold uppercase tracking-wider text-bt-muted hover:border-bt-red hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${friendsLoading ? "animate-spin text-bt-red" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                {friendsLoading && !friendsLoaded && (
                  <div className="flex items-center gap-2 py-2 font-mono text-xs text-bt-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-bt-red shrink-0" />
                    <span>Loading Steam friends list...</span>
                  </div>
                )}

                {friendsError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 border border-bt-red/45 bg-bt-red/10 px-3 py-2 font-mono text-xs text-bt-red"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{friendsError}</span>
                  </div>
                )}

                {friendsLoaded && friendsIsPrivate && (
                  <div className="flex items-start gap-2.5 border border-amber-500/45 bg-amber-950/40 px-3 py-2.5">
                    <Lock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-condensed text-xs font-bold uppercase tracking-wider text-amber-200">
                        Steam Friends List is Private
                      </div>
                      <p className="font-mono text-[11px] text-amber-200/85">
                        {friendsHint ||
                          "Set Steam Profile -> Edit Profile -> Privacy Settings -> Friends List to Public to pick friends visually."}
                      </p>
                    </div>
                  </div>
                )}

                {friendsLoaded && !friendsIsPrivate && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[170px]">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bt-dim" />
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          aria-label="Search Steam friends"
                          placeholder="Search friends..."
                          className="w-full border border-bt-border bg-bt-bg py-1.5 pl-8 pr-7 font-mono text-xs text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                        />
                        {friendSearch && (
                          <button
                            type="button"
                            onClick={() => setFriendSearch("")}
                            aria-label="Clear friend search"
                            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-bt-muted hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="inline-flex border border-bt-border bg-bt-bg p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPickerMode("active");
                            setPickerNotice(null);
                          }}
                          aria-pressed={pickerMode === "active"}
                          className={`cursor-pointer px-2.5 py-1 font-condensed text-[11px] font-bold uppercase tracking-wider transition-colors ${
                            pickerMode === "active"
                              ? "bg-bt-red text-white"
                              : "text-bt-muted hover:text-white"
                          }`}
                        >
                          Add to Active ({verifiableActiveCount}/6)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPickerMode("waitlist");
                            setPickerNotice(null);
                          }}
                          aria-pressed={pickerMode === "waitlist"}
                          className={`cursor-pointer px-2.5 py-1 font-condensed text-[11px] font-bold uppercase tracking-wider transition-colors ${
                            pickerMode === "waitlist"
                              ? "bg-bt-red text-white"
                              : "text-bt-muted hover:text-white"
                          }`}
                        >
                          Add to Waitlist
                        </button>
                      </div>

                      <span className="font-mono text-[11px] text-bt-muted whitespace-nowrap">
                        <span className="font-semibold text-white">
                          {selectedFriendsCount}
                        </span>{" "}
                        selected
                      </span>
                    </div>

                    {pickerNotice && (
                      <div className="flex items-center gap-2 border border-amber-500/45 bg-amber-950/40 px-3 py-1.5 font-mono text-[11px] text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>{pickerNotice}</span>
                      </div>
                    )}

                    {filteredFriends.length === 0 ? (
                      <div className="border border-dashed border-bt-border bg-bt-bg/60 py-4 text-center font-mono text-xs text-bt-muted">
                        {friends.length === 0
                          ? "No Steam friends found on your profile."
                          : `No friends match "${friendSearch}".`}
                      </div>
                    ) : (
                      <div className="max-h-[260px] overflow-y-auto tier-rail grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
                        {filteredFriends.map((friend) => {
                          const match = friendPlacementMap.get(
                            friend.steamId64
                          );
                          const placement = match?.placement ?? null;
                          return (
                            <button
                              key={friend.steamId64}
                              type="button"
                              onClick={() => toggleFriendSelection(friend)}
                              aria-pressed={placement !== null}
                              className={`cursor-pointer group flex items-center gap-2 border p-2 text-left transition-colors ${
                                placement
                                  ? "border-bt-red bg-bt-red/15 text-white"
                                  : "border-bt-border bg-bt-bg/85 text-white hover:border-bt-red/60 hover:bg-bt-bg"
                              }`}
                            >
                              {friend.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={friend.avatarUrl}
                                  alt={friend.personaName}
                                  className="h-8 w-8 shrink-0 object-cover border border-bt-border"
                                />
                              ) : (
                                <div className="h-8 w-8 shrink-0 border border-bt-border bg-bt-elevated flex items-center justify-center font-mono text-[10px] text-bt-muted">
                                  {friend.personaName
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-xs text-white leading-tight">
                                  {friend.personaName}
                                </div>
                                {placement ? (
                                  <span
                                    className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                                      placement === "active"
                                        ? "bg-bt-red text-white"
                                        : "border border-bt-red/60 bg-bt-bg text-bt-red"
                                    }`}
                                  >
                                    <Check className="h-2.5 w-2.5 shrink-0" />
                                    {placement === "active"
                                      ? "ACTIVE"
                                      : "WAITLIST"}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block font-mono text-[10px] text-bt-dim group-hover:text-bt-muted">
                                    Click to add
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Bulk Paste Panel */}
            {bulkOpen && (
              <div className="border border-bt-red/40 bg-bt-elevated/90 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardPaste className="h-4 w-4 text-bt-red" />
                    <span className="font-condensed text-xs font-bold uppercase tracking-[0.18em] text-white">
                      Bulk Paste Steam Profiles (Up to 6 Lines)
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
                    Replaces active slots ·{" "}
                    {hasApiKey
                      ? "Auto-resolves persona names, avatars & game visibility"
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

            {/* Active Members Section */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 bg-bt-red" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-red">
                    Active Members ({draftMembers.length}/6)
                  </span>
                </div>
                {draftMembers.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addMember(false)}
                    className="cursor-pointer inline-flex items-center gap-1 border border-bt-red/50 bg-bt-red/10 px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Slot
                  </button>
                )}
              </div>

              <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2.5 pb-1.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                <span className="sm:col-span-3">Display Name</span>
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

              <div className="space-y-2">
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
                          aria-label={`Member ${idx + 1} display name`}
                          placeholder="Auto-filled on verify"
                          className="sm:col-span-3 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                        />
                        <input
                          type="text"
                          value={m.steamUrlOrId}
                          onChange={(e) =>
                            updateRow(false, m.id, {
                              steamUrlOrId: e.target.value,
                            })
                          }
                          onBlur={(e) =>
                            maybeAutoVerify(m.id, e.target.value, false)
                          }
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData("text");
                            if (!hasApiKey || !pasted.trim()) return;
                            const inputEl = e.currentTarget;
                            window.setTimeout(() => {
                              maybeAutoVerify(m.id, inputEl.value, false);
                            }, 0);
                          }}
                          aria-label={`Member ${idx + 1} Steam URL, vanity name, or SteamID64`}
                          placeholder="steamcommunity.com/id/... or 7656119..."
                          className={`${
                            hasApiKey ? "sm:col-span-4" : "sm:col-span-5"
                          } border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-xs sm:text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none`}
                        />
                        <input
                          type="date"
                          value={m.joinDate ?? ""}
                          onChange={(e) =>
                            updateRow(false, m.id, { joinDate: e.target.value })
                          }
                          aria-label={`Member ${idx + 1} join date`}
                          className="sm:col-span-3 border border-bt-border bg-bt-bg px-2 py-1.5 font-mono text-xs sm:text-sm text-white [color-scheme:dark] focus:border-bt-red focus:outline-none"
                        />
                        <div
                          className={`${
                            hasApiKey ? "sm:col-span-2" : "sm:col-span-1"
                          } flex items-center justify-end sm:justify-end gap-1.5`}
                        >
                          {hasApiKey && (
                            <button
                              type="button"
                              onClick={() =>
                                verifyRow(m.id, m.steamUrlOrId, false)
                              }
                              disabled={!m.steamUrlOrId.trim() || isVerifying}
                              title="Verify Steam profile & public game count"
                              aria-label={`Verify ${m.name || `member ${idx + 1}`}`}
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
                              delete lastVerifiedInputsRef.current[m.id];
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
                            title="Remove member"
                            aria-label={`Remove ${m.name || `member ${idx + 1}`}`}
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
            </div>

            {/* Waitlist Challengers Section */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 bg-bt-muted" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                    Waitlist Challengers ({draftWaitlist.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addMember(true)}
                  className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-elevated px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:border-bt-red transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Waitlist
                </button>
              </div>

              {draftWaitlist.length === 0 ? (
                <div className="border border-dashed border-bt-border bg-bt-bg/60 px-4 py-4 text-center font-mono text-xs text-bt-muted">
                  No waitlisted friends staged. Click &ldquo;Add Waitlist&rdquo;
                  to test swap impact in the Swap Simulator.
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2.5 pb-1.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                    <span className="sm:col-span-4">Display Name</span>
                    <span
                      className={hasApiKey ? "sm:col-span-6" : "sm:col-span-7"}
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

                  <div className="space-y-2">
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
                                updateRow(true, w.id, { name: e.target.value })
                              }
                              aria-label={`Waitlist member ${idx + 1} display name`}
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
                              onBlur={(e) =>
                                maybeAutoVerify(w.id, e.target.value, true)
                              }
                              onPaste={(e) => {
                                const pasted = e.clipboardData.getData("text");
                                if (!hasApiKey || !pasted.trim()) return;
                                const inputEl = e.currentTarget;
                                window.setTimeout(() => {
                                  maybeAutoVerify(w.id, inputEl.value, true);
                                }, 0);
                              }}
                              aria-label={`Waitlist member ${idx + 1} Steam URL, vanity name, or SteamID64`}
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
                                  aria-label={`Verify ${w.name || `waitlist member ${idx + 1}`}`}
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
                                  delete lastVerifiedInputsRef.current[w.id];
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
                                title="Remove waitlisted member"
                                aria-label={`Remove ${w.name || `waitlist member ${idx + 1}`}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {renderVerificationStrip(w)}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-bt-border bg-bt-bg/95 px-5 sm:px-6 py-4">
            <div className="font-mono text-[11px] text-bt-muted">
              {cleanActivePreview.length > 0 ? (
                <span>
                  <span className="text-white font-medium">
                    {cleanActivePreview.length}
                  </span>{" "}
                  valid active{" "}
                  {cleanActivePreview.length === 1 ? "slot" : "slots"}
                  {cleanWaitlistPreview.length > 0
                    ? ` · ${cleanWaitlistPreview.length} waitlist`
                    : ""}
                </span>
              ) : (
                <span>Enter at least 1 Steam profile URL or SteamID64</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer border border-bt-border px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-bt-muted hover:border-white/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={cleanActivePreview.length === 0 || bulkBusy}
                className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>Save &amp; Re-Analyze</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
