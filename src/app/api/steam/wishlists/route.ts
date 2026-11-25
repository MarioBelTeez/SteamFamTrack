import { NextRequest, NextResponse } from "next/server";
import { getFamilyWishlists } from "@/lib/steam-check";
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
  const limit = checkRateLimit(`steam-wishlists:${ip}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as {
      region?: string;
      members?: Array<{ memberId?: string; name?: string; steamId64?: string }>;
    };

    const members = (body.members ?? [])
      .filter(
        (m): m is { memberId: string; name: string; steamId64: string } =>
          typeof m.memberId === "string" &&
          typeof m.name === "string" &&
          typeof m.steamId64 === "string" &&
          /^\d{17}$/.test(m.steamId64)
      )
      .slice(0, 12);

    if (members.length === 0) {
      return NextResponse.json({ items: [], privateMembers: [] });
    }

    const region = parseRegion(body.region);
    const result = await getFamilyWishlists({ members, region });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load family wishlists.",
      },
      { status: 500 }
    );
  }
}
