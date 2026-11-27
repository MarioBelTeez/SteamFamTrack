"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  APP_THEMES,
  AppTheme,
  DEFAULT_THEME_ID,
  ThemeId,
  ThemeMode,
  applyThemeToDocument,
  getThemeById,
  readStoredThemeId,
  saveStoredThemeId,
} from "@/lib/themes";
import {
  Check,
  ChevronDown,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
} from "lucide-react";

export const THEME_CHANGE_EVENT = "sft-theme-change";

export function syncThemeAcrossApp(nextId: ThemeId): void {
  saveStoredThemeId(nextId);
  applyThemeToDocument(nextId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ThemeId>(THEME_CHANGE_EVENT, { detail: nextId })
    );
  }
}

export function useAppTheme() {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [previewId, setPreviewId] = useState<ThemeId | null>(null);

  useEffect(() => {
    const stored = readStoredThemeId();
    applyThemeToDocument(stored);
    queueMicrotask(() => setThemeId(stored));

    const handleSync = (e: Event) => {
      const next = (e as CustomEvent<ThemeId>).detail;
      if (next) {
        setThemeId(next);
        setPreviewId(null);
      }
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleSync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleSync);
  }, []);

  const selectTheme = useCallback((nextId: ThemeId) => {
    setThemeId(nextId);
    setPreviewId(null);
    syncThemeAcrossApp(nextId);
    fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: nextId }),
    }).catch(() => {});
  }, []);

  const startPreview = useCallback((nextId: ThemeId) => {
    setPreviewId(nextId);
    applyThemeToDocument(nextId);
  }, []);

  const endPreview = useCallback(() => {
    setPreviewId(null);
    applyThemeToDocument(readStoredThemeId());
  }, []);

  const activeTheme = getThemeById(themeId);

  return {
    themeId,
    previewId,
    activeTheme,
    selectTheme,
    startPreview,
    endPreview,
  };
}

function ThemeMiniPreview({ theme }: { theme: AppTheme }) {
  const { tokens } = theme;
  return (
    <div
      className="relative w-full h-[112px] overflow-hidden border"
      style={{
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
      }}
      aria-hidden="true"
    >
      {/* Top 2px accent stripe */}
      <div className="h-[2px] w-full" style={{ backgroundColor: tokens.accent }} />

      {/* Mock header bar */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 border-b"
        style={{
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 inline-block"
            style={{ backgroundColor: tokens.accent }}
          />
          <span
            className="h-1.5 w-14 rounded-xs"
            style={{ backgroundColor: tokens.ink, opacity: 0.85 }}
          />
        </div>
        <span
          className="h-2 w-8"
          style={{ backgroundColor: tokens.accent }}
        />
      </div>

      {/* Mock 2-column workspace */}
      <div className="grid grid-cols-[44px_1fr] gap-2 p-2.5 h-[82px]">
        {/* Mini sidebar */}
        <div
          className="p-1.5 space-y-1.5 border"
          style={{
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
          }}
        >
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: tokens.accent }}
          />
          <div
            className="h-1.5 w-4/5"
            style={{ backgroundColor: tokens.muted, opacity: 0.45 }}
          />
          <div
            className="h-1.5 w-3/4"
            style={{ backgroundColor: tokens.muted, opacity: 0.35 }}
          />
          <div
            className="h-1.5 w-4/5"
            style={{ backgroundColor: tokens.muted, opacity: 0.3 }}
          />
        </div>

        {/* Mini main stage */}
        <div className="space-y-1.5">
          {/* KPI chips */}
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-6 border p-1 flex flex-col justify-between"
                style={{
                  backgroundColor: tokens.surface,
                  borderColor: i === 2 ? tokens.accent : tokens.border,
                }}
              >
                <div
                  className="h-1 w-2/3"
                  style={{ backgroundColor: tokens.dim }}
                />
                <div
                  className="h-1.5 w-1/2"
                  style={{
                    backgroundColor: i === 2 ? tokens.accent : tokens.ink,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Fairness / leaderboard bar */}
          <div
            className="border p-1.5 space-y-1.5"
            style={{
              backgroundColor: tokens.elevated,
              borderColor: tokens.border,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-1.5 w-12"
                style={{ backgroundColor: tokens.ink, opacity: 0.85 }}
              />
              <div
                className="h-1.5 w-6"
                style={{ backgroundColor: tokens.accent }}
              />
            </div>
            <div
              className="h-2 w-full overflow-hidden flex"
              style={{ backgroundColor: tokens.bg }}
            >
              <div
                className="h-full w-3/5"
                style={{ backgroundColor: tokens.accent }}
              />
              <div
                className="h-full w-1/5"
                style={{ backgroundColor: tokens.muted, opacity: 0.4 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThemeGalleryTabProps {
  onThemeApplied?: (theme: AppTheme) => void;
}

export function ThemeGalleryTab({ onThemeApplied }: ThemeGalleryTabProps) {
  const { themeId, previewId, activeTheme, selectTheme, startPreview, endPreview } =
    useAppTheme();
  const [modeFilter, setModeFilter] = useState<"all" | ThemeMode>("all");

  useEffect(() => {
    return () => {
      applyThemeToDocument(readStoredThemeId());
    };
  }, []);

  const darkCount = APP_THEMES.filter((t) => t.mode === "dark").length;
  const lightCount = APP_THEMES.filter((t) => t.mode === "light").length;

  const visibleThemes =
    modeFilter === "all"
      ? APP_THEMES
      : APP_THEMES.filter((t) => t.mode === modeFilter);

  const handleSelect = (theme: AppTheme) => {
    selectTheme(theme.id);
    onThemeApplied?.(theme);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="p5-frame bg-bt-border">
        <div className="bg-bt-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-1 h-10 bg-bt-red shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-red flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  LIVE APPEARANCE STUDIO // SAVED LOCALLY
                </div>
                <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-white mt-1 leading-none">
                  PICK YOUR STEAM FAMILY VIBE
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-bt-muted">
                  Hover any palette to preview it live across the entire dashboard. Click to save it to this browser.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filter themes by mode"
                className="inline-flex border border-bt-border bg-bt-bg p-0.5"
              >
                {(
                  [
                    { id: "all", label: `All (${APP_THEMES.length})` },
                    { id: "dark", label: `Dark (${darkCount})` },
                    { id: "light", label: `Light (${lightCount})` },
                  ] as const
                ).map((tab) => {
                  const active = modeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModeFilter(tab.id)}
                      className={`cursor-pointer px-3 py-1 font-condensed text-xs font-bold uppercase tracking-wider transition-colors ${
                        active
                          ? "bg-bt-red text-white"
                          : "text-bt-muted hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {themeId !== DEFAULT_THEME_ID && (
                <button
                  type="button"
                  onClick={() => handleSelect(getThemeById(DEFAULT_THEME_ID))}
                  className="cursor-pointer inline-flex items-center gap-1.5 border border-bt-border bg-bt-elevated hover:border-bt-red px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bt-muted hover:text-white transition-colors"
                >
                  <RotateCcw className="h-3 w-3 text-bt-red" />
                  Reset Default
                </button>
              )}
            </div>
          </div>

          {/* Active Theme Telemetry Strip */}
          <div className="border-t border-bt-border/80 pt-3.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 border border-bt-border shrink-0"
                style={{ backgroundColor: activeTheme.tokens.accent }}
              />
              <span className="text-bt-muted uppercase tracking-wider">
                Active Theme:
              </span>
              <span className="font-semibold text-white">
                {activeTheme.name}
              </span>
              <span className="text-bt-dim">({activeTheme.inspiredBy})</span>
            </div>

            {previewId && previewId !== themeId && (
              <span className="border border-bt-red/50 bg-bt-red/15 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-bt-red font-semibold">
                Previewing: {getThemeById(previewId).name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Theme Palette Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
        onMouseLeave={endPreview}
      >
        {visibleThemes.map((theme) => {
          const isSelected = theme.id === themeId;
          const isPreviewing = previewId === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelect(theme)}
              onMouseEnter={() => startPreview(theme.id)}
              onFocus={() => startPreview(theme.id)}
              onBlur={endPreview}
              aria-pressed={isSelected}
              className={`p5-frame-sm p5-frame-interactive cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
                isSelected || isPreviewing
                  ? "bg-bt-red"
                  : "bg-bt-border hover:bg-bt-red/70"
              }`}
            >
              <div className="bg-bt-surface p-4 h-full flex flex-col justify-between gap-3.5">
                <div className="space-y-3">
                  {/* Live Mini UI Preview */}
                  <ThemeMiniPreview theme={theme} />

                  {/* Title & Mode Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl leading-none tracking-wide text-white truncate">
                        {theme.name}
                      </h3>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bt-dim truncate">
                        {theme.inspiredBy}
                      </p>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-1 border border-bt-border bg-bt-elevated px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bt-muted">
                      {theme.mode === "dark" ? (
                        <Moon className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Sun className="h-3 w-3" aria-hidden="true" />
                      )}
                      {theme.mode}
                    </span>
                  </div>

                  <p className="text-xs text-bt-muted leading-relaxed">
                    {theme.tagline}
                  </p>
                </div>

                {/* Swatch Bar + Active Status */}
                <div className="border-t border-bt-border/80 pt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {[
                      theme.tokens.bg,
                      theme.tokens.surface,
                      theme.tokens.elevated,
                      theme.tokens.accent,
                      theme.tokens.ink,
                    ].map((hex, i) => (
                      <span
                        key={`${theme.id}-sw-${i}`}
                        className="h-4 w-4 border border-bt-border/90"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>

                  {isSelected ? (
                    <span className="p5-tag bg-bt-red px-2 py-0.5 text-white">
                      <span className="p5-unskew inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider">
                        <Check className="h-3 w-3" />
                        Active
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-bt-dim">
                      Apply →
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface HeaderThemeSwitcherProps {
  onOpenThemesTab?: () => void;
}

export function HeaderThemeSwitcher({
  onOpenThemesTab,
}: HeaderThemeSwitcherProps) {
  const { themeId, activeTheme, selectTheme, startPreview, endPreview } =
    useAppTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        endPreview();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        endPreview();
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, endPreview]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Change color theme (current: ${activeTheme.name})`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) endPreview();
          setOpen((prev) => !prev);
        }}
        className="cursor-pointer inline-flex items-center gap-2 border border-bt-border bg-bt-surface hover:border-bt-red px-2.5 py-1.5 font-mono text-xs text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red"
      >
        <span
          className="h-3 w-3 border border-bt-border shrink-0"
          style={{ backgroundColor: activeTheme.tokens.accent }}
          aria-hidden="true"
        />
        <Palette className="h-3.5 w-3.5 text-bt-red shrink-0" aria-hidden="true" />
        <span className="hidden md:inline max-w-[145px] truncate">
          {activeTheme.name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-bt-muted transition-transform ${
            open ? "rotate-180 text-bt-red" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Select theme palette"
          onMouseLeave={endPreview}
          className="absolute right-0 z-50 mt-1.5 w-[245px] border border-bt-red/70 bg-bt-surface shadow-2xl py-1"
        >
          <div className="px-3 py-1.5 border-b border-bt-border/80 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-bt-dim">
            <span>Color Palette</span>
            <span>{APP_THEMES.length} Themes</span>
          </div>

          <div className="max-h-[320px] overflow-y-auto tier-rail py-1">
            {APP_THEMES.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onMouseEnter={() => startPreview(theme.id)}
                  onClick={() => {
                    selectTheme(theme.id);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`cursor-pointer w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors ${
                    selected
                      ? "bg-bt-red/20 text-white border-l-2 border-l-bt-red"
                      : "text-bt-muted hover:bg-bt-elevated hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center shrink-0">
                      <span
                        className="h-3.5 w-2.5 border border-bt-border"
                        style={{ backgroundColor: theme.tokens.bg }}
                      />
                      <span
                        className="h-3.5 w-2.5 border-y border-r border-bt-border"
                        style={{ backgroundColor: theme.tokens.accent }}
                      />
                    </span>
                    <span className="truncate">{theme.name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 shrink-0 text-[10px] text-bt-dim uppercase">
                    {theme.mode === "light" ? (
                      <Sun className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Moon className="h-3 w-3" aria-hidden="true" />
                    )}
                    {selected && <Check className="h-3 w-3 text-bt-red" />}
                  </span>
                </button>
              );
            })}
          </div>

          {onOpenThemesTab && (
            <div className="border-t border-bt-border/80 p-1.5">
              <button
                type="button"
                onClick={() => {
                  endPreview();
                  setOpen(false);
                  onOpenThemesTab();
                }}
                className="cursor-pointer w-full px-2.5 py-1.5 bg-bt-elevated hover:bg-bt-red text-white font-condensed text-xs font-bold uppercase tracking-wider text-center transition-colors"
              >
                Open Full Themes Studio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
