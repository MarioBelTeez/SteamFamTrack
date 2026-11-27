import { NextRequest, NextResponse } from "next/server";
import { fetchSteamProfileFlex } from "@/lib/steam";
import { STEAM_REGIONS, type SteamRegion } from "@/lib/types";

function parseRegion(value: string | null): SteamRegion {
  if (value && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return "ma";
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.STEAM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "STEAM_API_KEY is not configured on this server." },
      { status: 503 }
    );
  }

  const query = (
    req.nextUrl.searchParams.get("query") ||
    req.nextUrl.searchParams.get("steamId64") ||
    ""
  ).trim();
  if (!query) {
    return NextResponse.json(
      { error: "Provide a Steam profile URL, vanity name, or SteamID64." },
      { status: 400 }
    );
  }

  const region = parseRegion(req.nextUrl.searchParams.get("region"));

  try {
    const profile = await fetchSteamProfileFlex(query, region, apiKey);
    return NextResponse.json(
      {
        profile,
        currencySymbol: STEAM_REGIONS[region].symbol,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load Steam profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
