import { NextRequest, NextResponse } from "next/server";
import { getSteamUserFromRequest } from "@/lib/family-access";
import { getSteamFamDb } from "@/lib/supabase";
import { STEAM_REGIONS, type SteamRegion } from "@/lib/types";

function parseRegion(value: unknown): SteamRegion | null {
  if (typeof value === "string" && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { user: null, preferredRegion: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { user, preferredRegion: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data } = await db
    .from("steam_preferences")
    .select("preferred_region")
    .eq("steam_id64", user.steamId64)
    .maybeSingle();

  const preferredRegion = parseRegion(data?.preferred_region);

  return NextResponse.json(
    { user, preferredRegion },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: NextRequest) {
  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with Steam to save account preferences." },
      { status: 401 }
    );
  }

  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  let body: { region?: unknown };
  try {
    body = (await req.json()) as { region?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const region = parseRegion(body?.region);
  if (!region) {
    return NextResponse.json(
      { error: "Unsupported Steam pricing region." },
      { status: 400 }
    );
  }

  const { error } = await db.from("steam_preferences").upsert(
    {
      steam_id64: user.steamId64,
      preferred_region: region,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "steam_id64" }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save preference." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { preferredRegion: region },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
