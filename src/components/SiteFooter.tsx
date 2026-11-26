"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-bt-border bg-bt-surface/75">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-bt-muted leading-relaxed">
          SteamFamTrack is an independent, open-source community tool by{" "}
          <a
            href="https://belteez.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-bt-red transition-colors underline underline-offset-2"
          >
            BelTeez Studio
          </a>{" "}
          and is <span className="text-white">not affiliated with, endorsed by, or sponsored by Valve Corporation</span>.
          Steam and the Steam logo are trademarks of Valve Corporation. Store and library data are provided as-is via the Steam Web API.
        </p>

        <nav
          aria-label="Legal and project links"
          className="flex flex-wrap items-center gap-4 shrink-0 font-mono text-[11px] uppercase tracking-wider text-bt-muted"
        >
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 hover:text-bt-red transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-bt-red" aria-hidden="true" />
            <span>Privacy &amp; Data</span>
          </Link>
          <a
            href="https://github.com/MarioBelTeez/SteamFamTrack"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-bt-red transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/MarioBelTeez/SteamFamTrack/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-bt-red transition-colors"
          >
            AGPL-3.0
          </a>
        </nav>
      </div>
    </footer>
  );
}
