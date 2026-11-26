import { NextRequest, NextResponse } from "next/server";
import { getPopularSteamDiscounts } from "@/lib/steam-check";
import { STEAM_REGIONS, SteamRegion } from "@/lib/types";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function parseRegion(value: string | null): SteamRegion {
  if (value && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return "us";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`steam-discounts:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const region = parseRegion(req.nextUrl.searchParams.get("region"));
    const items = await getPopularSteamDiscounts(region);
    return NextResponse.json(
      { region, items },
      {
        headers: {
          "Cache-Control":
            items.length > 0
              ? "public, s-maxage=300, stale-while-revalidate=600"
              : "no-store",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load Steam discounts.",
      },
      { status: 500 }
    );
  }
}
