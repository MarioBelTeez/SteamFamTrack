"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { STEAM_REGIONS, SteamRegion } from "@/lib/types";
import { ChevronDown } from "lucide-react";

function RegionFlag({ code }: { code: SteamRegion }) {
  switch (code) {
    case "ma":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#C1272D" />
          <polygon
            points="10,3 11.1,6.3 14.5,6.3 11.8,8.3 12.8,11.5 10,9.5 7.2,11.5 8.2,8.3 5.5,6.3 8.9,6.3"
            fill="none"
            stroke="#006233"
            strokeWidth="1.15"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "us":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#FFFFFF" />
          <rect y="0" width="20" height="2" fill="#B22234" />
          <rect y="4" width="20" height="2" fill="#B22234" />
          <rect y="8" width="20" height="2" fill="#B22234" />
          <rect y="12" width="20" height="2" fill="#B22234" />
          <rect width="9" height="8" fill="#3C3B6E" />
          <circle cx="2.5" cy="2.2" r="0.6" fill="#FFFFFF" />
          <circle cx="5.5" cy="2.2" r="0.6" fill="#FFFFFF" />
          <circle cx="4" cy="4" r="0.6" fill="#FFFFFF" />
          <circle cx="2.5" cy="5.8" r="0.6" fill="#FFFFFF" />
          <circle cx="5.5" cy="5.8" r="0.6" fill="#FFFFFF" />
        </svg>
      );
    case "eu":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#003399" />
          <g fill="#FFCC00">
            <circle cx="10" cy="2.8" r="0.65" />
            <circle cx="10" cy="11.2" r="0.65" />
            <circle cx="5.8" cy="7" r="0.65" />
            <circle cx="14.2" cy="7" r="0.65" />
            <circle cx="7" cy="4" r="0.65" />
            <circle cx="13" cy="4" r="0.65" />
            <circle cx="7" cy="10" r="0.65" />
            <circle cx="13" cy="10" r="0.65" />
          </g>
        </svg>
      );
    case "gb":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#012169" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#FFFFFF" strokeWidth="2.4" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.1" />
          <path d="M10,0 V14 M0,7 H20" stroke="#FFFFFF" strokeWidth="3.6" />
          <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2" />
        </svg>
      );
    case "br":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#009C3B" />
          <polygon points="10,1.8 17.5,7 10,12.2 2.5,7" fill="#FFDF00" />
          <circle cx="10" cy="7" r="2.7" fill="#002776" />
        </svg>
      );
    case "jp":
      return (
        <svg
          viewBox="0 0 20 14"
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/15"
          aria-hidden="true"
        >
          <rect width="20" height="14" fill="#FFFFFF" />
          <circle cx="10" cy="7" r="3.6" fill="#BC002D" />
        </svg>
      );
  }
}

interface RegionSelectProps {
  value: SteamRegion;
  onChange: (region: SteamRegion) => void;
  ariaLabel?: string;
  compact?: boolean;
}

export function RegionSelect({
  value,
  onChange,
  ariaLabel = "Pricing region",
  compact = false,
}: RegionSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const options = Object.values(STEAM_REGIONS);
  const current = STEAM_REGIONS[value] ?? STEAM_REGIONS.us;

  useEffect(() => {
    if (!open) return;

    const selectedIdx = Math.max(
      0,
      options.findIndex((r) => r.code === current.code)
    );
    optionRefs.current[selectedIdx]?.focus();

    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOptionKeyDown = (
    idx: number,
    e: ReactKeyboardEvent<HTMLButtonElement>
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionRefs.current[(idx + 1) % options.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      optionRefs.current[(idx - 1 + options.length) % options.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      optionRefs.current[options.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`cursor-pointer inline-flex items-center justify-between gap-2 bg-bt-bg border border-bt-border font-mono text-xs text-white hover:border-bt-red transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-red ${
          compact ? "px-2.5 py-1.5" : "px-3 py-1.5"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <RegionFlag code={current.code} />
          <span>{current.label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-bt-muted transition-transform ${
            open ? "rotate-180 text-bt-red" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 sm:left-auto sm:right-0 z-50 mt-1.5 min-w-[215px] border border-bt-red/70 bg-bt-surface shadow-2xl py-1"
        >
          {options.map((r, idx) => {
            const selected = r.code === current.code;
            return (
              <button
                key={r.code}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                onKeyDown={(e) => handleOptionKeyDown(idx, e)}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                  if (r.code !== current.code) {
                    onChange(r.code);
                  }
                }}
                className={`cursor-pointer w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors focus-visible:outline-none focus-visible:bg-bt-elevated focus-visible:text-white ${
                  selected
                    ? "bg-bt-red/20 text-white border-l-2 border-l-bt-red"
                    : "text-bt-muted hover:bg-bt-elevated hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <RegionFlag code={r.code} />
                  <span>{r.label}</span>
                </span>
                <span className="text-[10px] text-bt-dim">{r.symbol}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
