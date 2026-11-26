import { NextRequest, NextResponse } from "next/server";
import {
  STEAM_SESSION_COOKIE,
  buildSteamSessionCookieOptions,
  fetchSteamUserProfile,
  getPublicOrigin,
  signDiscordLinkToken,
  signSteamSession,
} from "@/lib/steam-auth";
import { getSteamFamDb } from "@/lib/supabase";

const DEFAULT_DISCORD_CLIENT_ID = "1575252351776989296";

interface DiscordTokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface DiscordUserResponse {
  id?: string;
  username?: string;
  global_name?: string | null;
}

export async function POST(req: NextRequest) {
  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json(
      { error: "Missing Discord authorization code." },
      { status: 400 }
    );
  }

  const clientId =
    process.env.DISCORD_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID?.trim() ||
    DEFAULT_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();

  if (!clientSecret) {
    return NextResponse.json(
      {
        error:
          "Discord Activity OAuth is not configured on this server (missing DISCORD_CLIENT_SECRET).",
      },
      { status: 503 }
    );
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Discord token exchange failed (${tokenRes.status}). ${errText}`.trim(),
      },
      { status: 401 }
    );
  }

  const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
  if (!tokenData.access_token) {
    return NextResponse.json(
      { error: "Discord did not return an access token." },
      { status: 401 }
    );
  }

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Discord user profile." },
      { status: 401 }
    );
  }

  const discordUser = (await meRes.json()) as DiscordUserResponse;
  if (!discordUser.id) {
    return NextResponse.json(
      { error: "Discord user ID missing from profile." },
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

  const { data: linkRow, error: linkErr } = await db
    .from("discord_links")
    .select("steam_id64")
    .eq("discord_user_id", discordUser.id)
    .maybeSingle();

  if (linkErr) {
    return NextResponse.json(
      { error: linkErr.message || "Failed to look up Discord link." },
      { status: 500 }
    );
  }

  const steamId64 =
    typeof linkRow?.steam_id64 === "string" ? linkRow.steam_id64.trim() : "";

  if (!steamId64) {
    const linkToken = signDiscordLinkToken(discordUser.id);
    return NextResponse.json(
      {
        linked: false,
        discordUser: {
          id: discordUser.id,
          username: discordUser.username ?? "Discord User",
          globalName: discordUser.global_name ?? null,
        },
        linkToken,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const steamUser = await fetchSteamUserProfile(steamId64);
  const sessionToken = signSteamSession(steamUser);
  const origin = getPublicOrigin(req);

  const response = NextResponse.json(
    {
      linked: true,
      user: steamUser,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );

  response.cookies.set(
    STEAM_SESSION_COOKIE,
    sessionToken,
    buildSteamSessionCookieOptions(origin, true)
  );

  return response;
}
