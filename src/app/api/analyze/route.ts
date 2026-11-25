import { NextRequest, NextResponse } from "next/server";
import { analyzeFamily } from "@/lib/analyzer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { fetchMemberLibrariesLive } from "@/lib/steam";
import { hasSupabaseConfig } from "@/lib/supabase";
import {
  FamilyMemberInput,
  MemberLibrary,
  MemberLookupWarning,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    hasApiKey: Boolean(process.env.STEAM_API_KEY),
    hasDatabase: hasSupabaseConfig(),
    regions: Object.values(STEAM_REGIONS),
  });
}

interface AnalyzeRequestBody {
  mode?: "live";
  region?: SteamRegion;
  includeExcluded?: boolean;
  members?: FamilyMemberInput[];
  waitlist?: FamilyMemberInput[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody;
    const region: SteamRegion =
      body.region && body.region in STEAM_REGIONS ? body.region : "ma";
    const includeExcluded = Boolean(body.includeExcluded);

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "STEAM_API_KEY is not configured on the server. Add it to .env.local to analyze live Steam libraries.",
        },
        { status: 400 }
      );
    }

    const rawMembers = Array.isArray(body.members) ? body.members : [];
    const activeInputs = rawMembers
      .filter(
        (m) =>
          typeof m?.steamUrlOrId === "string" &&
          m.steamUrlOrId.trim().length > 0
      )
      .slice(0, 6);

    if (activeInputs.length === 0) {
      return NextResponse.json(
        {
          error:
            "Add at least one Steam profile URL, vanity name, or SteamID64 to analyze.",
        },
        { status: 400 }
      );
    }

    const waitlistInputs = (Array.isArray(body.waitlist) ? body.waitlist : [])
      .filter(
        (m) =>
          typeof m?.steamUrlOrId === "string" &&
          m.steamUrlOrId.trim().length > 0
      )
      .slice(0, 10);

    const ip = getClientIp(req.headers);
    const rl = checkRateLimit(`live-analyze:${ip}`, 20, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit reached for live Steam lookups. Try again in ${rl.resetInSeconds}s.`,
        },
        { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
      );
    }

    const [
      { libraries: activeLibraries, warnings: activeWarnings },
      { libraries: waitlistLibraries, warnings: waitlistWarnings },
    ] = await Promise.all([
      fetchMemberLibrariesLive(activeInputs, region, apiKey),
      waitlistInputs.length > 0
        ? fetchMemberLibrariesLive(waitlistInputs, region, apiKey)
        : Promise.resolve({
            libraries: [] as MemberLibrary[],
            warnings: [] as MemberLookupWarning[],
          }),
    ]);

    const warnings = [...activeWarnings, ...waitlistWarnings];

    if (activeLibraries.length === 0) {
      const failureSummary = activeWarnings
        .map((w) => `${w.memberName}: ${w.reason}`)
        .join("; ");
      return NextResponse.json(
        {
          error: failureSummary
            ? `Could not load any active Steam profiles: ${failureSummary}`
            : "Could not load any active Steam profiles. Verify the Steam IDs/URLs and ensure Game Details are set to Public.",
          warnings,
        },
        { status: 400 }
      );
    }

    const analysis = analyzeFamily(activeLibraries, region, includeExcluded);

    return NextResponse.json({
      mode: "live" as const,
      analysis,
      activeLibraries,
      waitlistLibraries,
      warnings,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze Steam Family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
