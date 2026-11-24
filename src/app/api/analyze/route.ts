import { NextRequest, NextResponse } from "next/server";
import { analyzeFamily } from "@/lib/analyzer";
import {
  DEMO_ACTIVE_INPUTS,
  DEMO_WAITLIST_INPUTS,
  buildDemoLibraries,
} from "@/lib/demo-data";
import { fetchMemberLibrariesLive } from "@/lib/steam";
import {
  FamilyMemberInput,
  MemberLibrary,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    hasApiKey: Boolean(process.env.STEAM_API_KEY),
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
        ? body.members
        : DEMO_ACTIVE_INPUTS;
    const waitlistInputs = body.waitlist ?? DEMO_WAITLIST_INPUTS;

    let activeLibraries: MemberLibrary[];
    let waitlistLibraries: MemberLibrary[];

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

      const [liveActive, liveWaitlist] = await Promise.all([
        fetchMemberLibrariesLive(activeInputs, region, apiKey),
        waitlistInputs.length > 0
          ? fetchMemberLibrariesLive(waitlistInputs, region, apiKey)
          : Promise.resolve([]),
      ]);
      activeLibraries = liveActive;
      waitlistLibraries = liveWaitlist;
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
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze Steam Family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
