import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Loader2, Lock, LogIn } from "lucide-react";
import { FamilyDashboard } from "@/components/FamilyDashboard";
import {
  canViewFamily,
  getSteamUserFromCookies,
  loadFamilyRecord,
} from "@/lib/family-access";
import { getSteamFamDb, hasSupabaseConfig } from "@/lib/supabase";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function SavedFamilyContent({ params }: PageProps) {
  const { slug } = await params;
  const [user, db] = await Promise.all([
    getSteamUserFromCookies(),
    Promise.resolve(getSteamFamDb()),
  ]);

  const family = db
    ? await loadFamilyRecord(db, { slug }, user?.steamId64 ?? null)
    : null;

  if (!family) {
    notFound();
  }

  if (!user || !canViewFamily(family, user.steamId64)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bt-bg px-6 py-12">
        <div className="w-full max-w-md p5-frame bg-bt-red/70">
          <div className="bg-bt-surface p-7 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center bg-bt-red/15 border border-bt-red/40 text-bt-red">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-red">
                  Access Restricted
                </p>
                <h1 className="font-display text-2xl uppercase tracking-wide text-white">
                  Private Steam Family
                </h1>
              </div>
            </div>

            <p className="text-sm text-bt-muted leading-relaxed">
              This Steam Family is private. Only the creator, active family
              members, and waitlisted friends on the roster can view its
              libraries and snapshots.
            </p>

            {user ? (
              <div className="flex flex-col gap-4 pt-1">
                <p className="font-mono text-xs text-bt-dim">
                  Signed in as{" "}
                  <span className="text-white">{user.personaName}</span> (
                  {user.steamId64}), which is not on this family&apos;s roster.
                </p>
                <Link
                  href="/"
                  className="p5-btn inline-flex items-center justify-center gap-2 bg-bt-red hover:bg-bt-red-hover text-white font-display uppercase tracking-wider text-sm px-5 py-3"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Launchpad</span>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-1">
                <a
                  href="/api/auth/steam"
                  className="p5-btn inline-flex items-center justify-center gap-2 bg-bt-red hover:bg-bt-red-hover text-white font-display uppercase tracking-wider text-sm px-5 py-3"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign in with Steam</span>
                </a>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-bt-muted hover:text-white py-2 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Launchpad</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasApiKey = Boolean(process.env.STEAM_API_KEY);
  const hasDatabase = hasSupabaseConfig();
  return (
    <FamilyDashboard
      initialFamily={family}
      initialHasApiKey={hasApiKey}
      initialHasDatabase={hasDatabase}
    />
  );
}

export default function SavedFamilyPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-bt-bg text-bt-muted font-mono text-xs uppercase tracking-widest px-6">
          <Loader2 className="h-7 w-7 animate-spin text-bt-red" />
          <span>Loading saved Steam Family...</span>
        </div>
      }
    >
      <SavedFamilyContent params={params} />
    </Suspense>
  );
}
