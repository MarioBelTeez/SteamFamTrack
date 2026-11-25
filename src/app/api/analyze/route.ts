import { NextRequest, NextResponse } from "next/server";
import { analyzeFamily } from "@/lib/analyzer";
import {
  DEMO_ACTIVE_INPUTS,
  DEMO_WAITLIST_INPUTS,
  buildDemoLibraries,
} from "@/lib/demo-data";
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
  mode?: "demo" | "live";
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
    const mode = body.mode ?? "demo";

    const activeInputs =
      body.members && body.members.length > 0
        ? body.members.slice(0, 6)
        : DEMO_ACTIVE_INPUTS;
    const waitlistInputs = (body.waitlist ?? DEMO_WAITLIST_INPUTS).slice(0, 10);

    let activeLibraries: MemberLibrary[];
    let waitlistLibraries: MemberLibrary[];
    let warnings: MemberLookupWarning[] = [];

    if (mode === "live") {
      const apiKey = process.env.STEAM_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "STEAM_API_KEY is not configured on the server. Add it to .env.local or use Demo Mode.",
          },
          { status: 400 }
        );
      }

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
        { libraries: liveActive, warnings: activeWarnings },
        { libraries: liveWaitlist, warnings: waitlistWarnings },
      ] = await Promise.all([
        fetchMemberLibrariesLive(activeInputs, region, apiKey),
        waitlistInputs.length > 0
          ? fetchMemberLibrariesLive(waitlistInputs, region, apiKey)
          : Promise.resolve({
              libraries: [] as MemberLibrary[],
              warnings: [] as MemberLookupWarning[],
            }),
      ]);

      activeLibraries = liveActive;
      waitlistLibraries = liveWaitlist;
      warnings = [...activeWarnings, ...waitlistWarnings];

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
    } else {
      activeLibraries = buildDemoLibraries(activeInputs, region);
      waitlistLibraries = buildDemoLibraries(waitlistInputs, region);
    }

    const analysis = analyzeFamily(activeLibraries, region, includeExcluded);

    return NextResponse.json({
      mode,
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
