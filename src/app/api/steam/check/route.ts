import { NextRequest, NextResponse } from "next/server";
import { checkSteamGame } from "@/lib/steam-check";
import { STEAM_REGIONS, SteamRegion } from "@/lib/types";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function parseRegion(value: unknown): SteamRegion {
  if (typeof value === "string" && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return "us";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`steam-check:${ip}`, 40, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as {
      query?: string;
      region?: string;
    };

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json(
        { error: "Provide a game name, AppID, or Steam Store URL." },
        { status: 400 }
      );
    }

    const region = parseRegion(body.region);
    const result = await checkSteamGame({ query, region });

    if (!result) {
      return NextResponse.json(
        { error: `No Steam game found matching "${query}".` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to check Steam game.",
      },
      { status: 500 }
    );
  }
}
