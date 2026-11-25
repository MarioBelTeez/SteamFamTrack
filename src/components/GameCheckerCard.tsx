"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SteamGameCheckResult } from "@/lib/steam-check";
import { MemberLibrary, STEAM_REGIONS, SteamRegion } from "@/lib/types";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  Users,
  XCircle,
} from "lucide-react";

interface GameCheckerCardProps {
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
  region: SteamRegion;
}

export function GameCheckerCard({
  activeLibraries,
  waitlistLibraries,
  region,
}: GameCheckerCardProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SteamGameCheckResult | null>(null);

  async function runCheck(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/steam/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, region }),
      });
      const data = (await res.json()) as SteamGameCheckResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to check game");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check game");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runCheck(query);
  }

  const ownership = useMemo(() => {
    if (!result) return { activeOwners: [], waitlistOwners: [] };
    const activeOwners = activeLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === result.appid)
    );
    const waitlistOwners = waitlistLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === result.appid)
    );
    return { activeOwners, waitlistOwners };
  }, [result, activeLibraries, waitlistLibraries]);

  const regionInfo = STEAM_REGIONS[region];

  return (
    <div className="space-y-6">
      <div className="p5-frame bg-bt-card border border-bt-border p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-red">
              PRE-PURCHASE & DISCOUNT CHECKER // {regionInfo.label}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-white mt-0.5">
              SHOULD YOU BUY THIS GAME?
            </h2>
          </div>
          <span className="p5-tag bg-bt-surface border border-bt-border text-bt-muted">
            LIVE STEAM STORE + FAMILY OVERLAP
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-bt-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Game title, AppID (e.g. 1245620), or Steam Store URL..."
              className="w-full bg-bt-surface border border-bt-border pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-bt-dim focus:outline-none focus:border-bt-red"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="p5-btn bg-bt-red hover:bg-bt-red/90 disabled:opacity-50 text-white px-5 py-2.5 font-condensed font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Checking...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Check Game
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="border border-bt-red/50 bg-bt-red/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-bt-red shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && (
        <div className="p5-frame bg-bt-card border border-bt-border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
            <div className="bg-bt-surface border-b lg:border-b-0 lg:border-r border-bt-border flex flex-col justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.headerImage}
                alt={result.name}
                className="w-full aspect-[460/215] object-cover"
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-bt-dim">
                    APPID {result.appid}
                  </span>
                  <a
                    href={result.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-bt-red hover:underline"
                  >
                    Steam Store <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="border-t border-bt-border/70 pt-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-bt-dim mb-1">
                    CURRENT PRICE ({regionInfo.code.toUpperCase()})
                  </div>
                  {result.isFree ? (
                    <div className="font-display text-2xl text-emerald-400">
                      FREE TO PLAY
                    </div>
                  ) : result.priceOverview ? (
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      {result.priceOverview.discountPercent > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold inline-flex items-center gap-1">
                          <Tag className="w-3 h-3" />-
                          {result.priceOverview.discountPercent}%
                        </span>
                      )}
                      <span className="font-display text-2xl text-white">
                        {result.priceOverview.finalFormatted}
                      </span>
                      {result.priceOverview.discountPercent > 0 &&
                        result.priceOverview.initialFormatted && (
                          <span className="font-mono text-xs text-bt-dim line-through">
                            {result.priceOverview.initialFormatted}
                          </span>
                        )}
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-bt-muted">
                      Price unavailable in this region
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div>
                <h3 className="font-display text-3xl text-white tracking-wide">
                  {result.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {result.isFree ? (
                    <span className="p5-tag bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Free to Play
                    </span>
                  ) : result.familySharingSupported ? (
                    <span className="p5-tag bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Family Sharing
                      Supported
                    </span>
                  ) : (
                    <span className="p5-tag bg-bt-red/15 border border-bt-red/50 text-red-200 inline-flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-bt-red" /> Opted
                      Out of Family Sharing
                    </span>
                  )}
                </div>
                <p className="text-xs text-bt-muted mt-2">
                  {result.familySharingNote}
                </p>
              </div>

              <div className="border-t border-bt-border pt-4 space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-bt-red" /> FAMILY
                  OWNERSHIP CHECK
                </div>

                {ownership.activeOwners.length > 0 ? (
                  <div className="border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2">
                    <div className="text-sm font-semibold text-emerald-300">
                      {result.familySharingSupported
                        ? `Already in your family! (${ownership.activeOwners.length} member${ownership.activeOwners.length > 1 ? "s" : ""} own it)`
                        : `Owned by ${ownership.activeOwners.length} active member${ownership.activeOwners.length > 1 ? "s" : ""}, but Family Sharing is disabled`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ownership.activeOwners.map((owner) => (
                        <span
                          key={owner.member.id}
                          className="px-2.5 py-1 bg-bt-surface border border-bt-border text-xs font-mono text-white"
                        >
                          {owner.personaName || owner.member.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-bt-border bg-bt-surface/70 p-3.5 text-sm text-bt-muted">
                    Nobody in your active 6-slot family owns{" "}
                    <span className="text-white font-medium">{result.name}</span>{" "}
                    yet.
                  </div>
                )}

                {ownership.waitlistOwners.length > 0 && (
                  <div className="text-xs font-mono text-bt-muted">
                    Waitlist owners:{" "}
                    <span className="text-white">
                      {ownership.waitlistOwners
                        .map((o) => o.personaName || o.member.name)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {result.alternatives.length > 1 && (
                <div className="border-t border-bt-border pt-4 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bt-dim">
                    OTHER STORE MATCHES
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.alternatives
                      .filter((alt) => alt.appid !== result.appid)
                      .map((alt) => (
                        <button
                          key={alt.appid}
                          type="button"
                          onClick={() => runCheck(String(alt.appid))}
                          className="px-2.5 py-1 bg-bt-surface hover:border-bt-red border border-bt-border text-xs text-bt-muted hover:text-white transition-colors"
                        >
                          {alt.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
