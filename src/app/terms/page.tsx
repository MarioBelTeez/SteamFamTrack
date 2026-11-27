import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Scale, ShieldAlert, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for using the SteamFamTrack web dashboard, Discord bot, and Discord Activity.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bt-bg text-bt-ink relative overflow-x-clip">
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none fixed inset-x-0 top-0 h-[360px] z-0 opacity-75"
      />

      <header className="sticky top-0 z-30 bg-bt-bg/95 backdrop-blur-md border-b border-bt-border">
        <div className="h-[2px] w-full bg-bt-red" />
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-condensed text-sm font-bold uppercase tracking-wider text-bt-muted hover:text-bt-red transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-bt-red" />
            <span>Back to SteamFamTrack</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-dim">
            TERMS OF SERVICE
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-2 border-b border-bt-border pb-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-bt-red">
            LEGAL {"//"} STEAMFT.COM &amp; DISCORD APP
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wider uppercase text-white leading-none">
            Terms of Service
          </h1>
          <p className="text-sm text-bt-muted max-w-2xl leading-relaxed">
            By using the SteamFamTrack web application (
            <span className="font-mono text-white">steamft.com</span>), the
            SteamFT Discord bot, or the SteamFT Discord Activity, you agree to
            these Terms of Service.
          </p>
        </div>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                1. What SteamFamTrack Provides
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              SteamFamTrack is a free, open-source (AGPL-3.0) community utility
              built by{" "}
              <a
                href="https://belteez.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bt-red hover:underline"
              >
                BelTeez Studio
              </a>{" "}
              for analyzing public Steam libraries, estimating Steam Family
              contributions, checking Family Sharing eligibility, and tracking
              group snapshots via web and Discord.
            </p>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                2. Acceptable Use &amp; Accounts
              </h2>
            </div>
            <ul className="space-y-2 text-sm text-bt-muted list-disc pl-5 leading-relaxed">
              <li>
                You must comply with{" "}
                <span className="font-semibold text-white">
                  Valve&apos;s Steam Subscriber Agreement
                </span>{" "}
                and{" "}
                <span className="font-semibold text-white">
                  Discord&apos;s Terms of Service &amp; Community Guidelines
                </span>{" "}
                when using SteamFamTrack.
              </li>
              <li>
                Do not abuse, scrape, flood, or attempt to bypass rate limits on
                the web app, API endpoints, or Discord bot commands.
              </li>
              <li>
                Only save Steam profiles that belong to you or friends who have
                shared their public Steam profile with your Steam Family group.
              </li>
              <li>
                We reserve the right to rate-limit, restrict, or remove abusive
                traffic or saved groups that violate these terms.
              </li>
            </ul>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                3. No Warranty &amp; Third-Party Data
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              SteamFamTrack is provided on an{" "}
              <span className="font-semibold text-white">&ldquo;as-is&rdquo;</span>{" "}
              and{" "}
              <span className="font-semibold text-white">
                &ldquo;as-available&rdquo;
              </span>{" "}
              basis without warranties of any kind. Regional pricing, game
              ownership, wishlists, and Family Sharing flags are fetched from
              the Steam Web API and Steam Store and may be delayed, incomplete,
              or unavailable if Valve changes or rate-limits its endpoints.
            </p>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <Scale className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                4. Non-Affiliation, Privacy &amp; Contact
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              SteamFamTrack is{" "}
              <span className="font-semibold text-white">
                not affiliated with, endorsed by, or sponsored by Valve
                Corporation or Discord Inc.
              </span>{" "}
              Data handling and deletion rights are covered in our{" "}
              <Link href="/privacy" className="text-bt-red hover:underline">
                Privacy &amp; Data Policy
              </Link>
              . Questions or takedown requests can be submitted via{" "}
              <a
                href="https://github.com/MarioBelTeez/SteamFamTrack/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bt-red hover:underline"
              >
                GitHub Issues
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
