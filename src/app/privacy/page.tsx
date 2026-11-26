import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database, KeyRound, ShieldCheck, Trash2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy & Steam API Data Policy",
  description:
    "How SteamFamTrack uses the Steam Web API, what account data is stored, and how you can delete your saved Steam Family at any time.",
};

export default function PrivacyPage() {
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
            PRIVACY &amp; API COMPLIANCE
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-2 border-b border-bt-border pb-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-bt-red">
            TRANSPARENCY // STEAM WEB API
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wider uppercase text-white leading-none">
            Privacy &amp; Data Policy
          </h1>
          <p className="text-sm text-bt-muted max-w-2xl leading-relaxed">
            SteamFamTrack is an open-source (AGPL-3.0) community utility built by
            BelTeez Studio. We only request and store the minimum public Steam
            identifiers needed to analyze your Steam Family.
          </p>
        </div>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                1. Steam OpenID 2.0 Sign-In (No Passwords Ever)
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              Signing in redirects you to Valve&apos;s official{" "}
              <span className="font-mono text-white">steamcommunity.com</span>{" "}
              OpenID login page. SteamFamTrack never sees or receives your Steam
              username, password, email address, Steam Guard codes, or payment
              details — only your public 17-digit{" "}
              <span className="font-mono text-white">SteamID64</span>. Your
              browser stores a signed,{" "}
              <span className="font-mono text-white">httpOnly</span> session
              cookie so you stay signed in across visits.
            </p>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                2. What Data Is Accessed &amp; Stored
              </h2>
            </div>
            <ul className="space-y-2 text-sm text-bt-muted list-disc pl-5 leading-relaxed">
              <li>
                <span className="font-semibold text-white">
                  Preview Sandbox (no sign-in):
                </span>{" "}
                Stateless. Public Steam profile summaries, owned games, and
                public wishlists are fetched on demand from the Steam Web API
                and are not saved to our database.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Saved Steam Families:
                </span>{" "}
                When you explicitly save a family while signed in, we store the
                family name, chosen pricing region, owner SteamID64, member
                SteamID64s/display names/join dates, and recorded weekly/monthly
                contribution snapshots. Saved families are private to the owner
                and listed family/waitlist members.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Discord Bot &amp; Activity Linking:
                </span>{" "}
                If you link Discord via <span className="font-mono text-white">/link</span>{" "}
                or the Discord Activity, we store a mapping between your Discord
                user ID and your verified SteamID64 so slash commands can load
                your private family.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Store Price Cache &amp; Browser Preferences:
                </span>{" "}
                Non-personal Steam Store game prices and Family Sharing flags
                (Category 62) are cached for up to 7 days to respect Steam API
                rate limits. Your selected color theme, starred games, and local
                claim notes are saved only in your browser&apos;s{" "}
                <span className="font-mono text-white">localStorage</span>.
              </li>
            </ul>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <Trash2 className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                3. Data Deletion &amp; Control
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              Family owners can permanently delete their saved family group and
              all associated snapshots at any time using the{" "}
              <span className="font-semibold text-white">Delete Family</span>{" "}
              button in the dashboard sidebar. You can sign out at any time to
              clear your session cookie, or open an issue on{" "}
              <a
                href="https://github.com/MarioBelTeez/SteamFamTrack/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bt-red hover:underline"
              >
                GitHub
              </a>{" "}
              if you need a Discord link record removed.
            </p>
          </div>
        </section>

        <section className="p5-frame bg-bt-border">
          <div className="bg-bt-surface p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-bt-red shrink-0" />
              <h2 className="font-condensed text-lg font-bold uppercase tracking-wider text-white">
                4. Valve Trademark &amp; Non-Affiliation Disclaimer
              </h2>
            </div>
            <p className="text-sm text-bt-muted leading-relaxed">
              SteamFamTrack is{" "}
              <span className="font-semibold text-white">
                not affiliated with, endorsed by, sponsored by, or officially
                connected to Valve Corporation
              </span>
              . Steam and the Steam logo are trademarks and/or registered
              trademarks of Valve Corporation in the U.S. and/or other
              countries. All game titles, cover art, pricing, and metadata are
              the property of their respective publishers and are provided on an
              &ldquo;as-is&rdquo; basis via the Steam Web API.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
