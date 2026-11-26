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
    let body: {
      region?: unknown;
      members?: unknown;
    };
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "Invalid request payload." },
          { status: 400 }
        );
      }
      body = parsed as { region?: unknown; members?: unknown };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const rawMembers = Array.isArray(body.members) ? body.members : [];
    const seenSteamIds = new Set<string>();
    const members: Array<{ memberId: string; name: string; steamId64: string }> =
      [];

    for (const raw of rawMembers) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as {
        memberId?: unknown;
        name?: unknown;
        steamId64?: unknown;
      };
      if (
        typeof m.memberId !== "string" ||
        typeof m.name !== "string" ||
        typeof m.steamId64 !== "string" ||
        !/^\d{17}$/.test(m.steamId64)
      ) {
        continue;
      }
      if (seenSteamIds.has(m.steamId64)) continue;
      seenSteamIds.add(m.steamId64);
      members.push({
        memberId: m.memberId.slice(0, 80),
        name: m.name.trim().slice(0, 80) || m.steamId64,
        steamId64: m.steamId64,
      });
      if (members.length >= 12) break;
    }

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
