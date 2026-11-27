import { NextRequest, NextResponse } from "next/server";
import { getSteamUserFromRequest } from "@/lib/family-access";
import { getSteamFamDb } from "@/lib/supabase";
import { isValidThemeId, type ThemeId } from "@/lib/themes";
import { STEAM_REGIONS, type SteamRegion } from "@/lib/types";

function parseRegion(value: unknown): SteamRegion | null {
  if (typeof value === "string" && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return null;
}

function parseTheme(value: unknown): ThemeId | null {
  return isValidThemeId(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { user: null, preferredRegion: null, preferredTheme: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { user, preferredRegion: null, preferredTheme: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data } = await db
    .from("steam_preferences")
    .select("preferred_region, preferred_theme")
    .eq("steam_id64", user.steamId64)
    .maybeSingle();

  return NextResponse.json(
    {
      user,
      preferredRegion: parseRegion(data?.preferred_region),
      preferredTheme: parseTheme(data?.preferred_theme),
    },
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

  let body: { region?: unknown; theme?: unknown };
  try {
    body = (await req.json()) as { region?: unknown; theme?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasRegion = body?.region !== undefined;
  const hasTheme = body?.theme !== undefined;

  if (!hasRegion && !hasTheme) {
    return NextResponse.json(
      { error: "Provide a region or theme to update." },
      { status: 400 }
    );
  }

  const region = hasRegion ? parseRegion(body.region) : null;
  if (hasRegion && !region) {
    return NextResponse.json(
      { error: "Unsupported Steam pricing region." },
      { status: 400 }
    );
  }

  const theme = hasTheme ? parseTheme(body.theme) : null;
  if (hasTheme && !theme) {
    return NextResponse.json(
      { error: "Unsupported theme ID." },
      { status: 400 }
    );
  }

  const upsertPayload: Record<string, string> = {
    steam_id64: user.steamId64,
    updated_at: new Date().toISOString(),
  };
  if (region) upsertPayload.preferred_region = region;
  if (theme) upsertPayload.preferred_theme = theme;

  const { data, error } = await db
    .from("steam_preferences")
    .upsert(upsertPayload, { onConflict: "steam_id64" })
    .select("preferred_region, preferred_theme")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save preference." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      preferredRegion: parseRegion(data?.preferred_region) ?? region,
      preferredTheme: parseTheme(data?.preferred_theme) ?? theme,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
