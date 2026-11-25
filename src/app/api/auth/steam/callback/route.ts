import { NextRequest, NextResponse } from "next/server";
import {
  STEAM_SESSION_COOKIE,
  STEAM_SESSION_TTL_SECONDS,
  getPublicOrigin,
  signSteamSession,
  verifySteamOpenIdCallback,
  type SteamSessionUser,
} from "@/lib/steam-auth";

async function fetchSteamUserProfile(
  steamId64: string
): Promise<SteamSessionUser> {
  const fallback: SteamSessionUser = {
    steamId64,
    personaName: steamId64,
    avatarUrl: "",
    profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
  };

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return fallback;

  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(
      apiKey
    )}&steamids=${encodeURIComponent(steamId64)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;

    const data = await res.json();
    const player = data?.response?.players?.[0];
    if (!player) return fallback;

    return {
      steamId64,
      personaName:
        typeof player.personaname === "string" && player.personaname.trim()
          ? player.personaname
          : steamId64,
      avatarUrl:
        typeof player.avatarfull === "string"
          ? player.avatarfull
          : typeof player.avatarmedium === "string"
            ? player.avatarmedium
            : typeof player.avatar === "string"
              ? player.avatar
              : "",
      profileUrl:
        typeof player.profileurl === "string" && player.profileurl.trim()
          ? player.profileurl
          : fallback.profileUrl,
    };
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const url = new URL(req.url);

  const steamId64 = await verifySteamOpenIdCallback(url.searchParams);
  if (!steamId64) {
    return NextResponse.redirect(`${origin}/?authError=steam_failed`, 302);
  }

  const user = await fetchSteamUserProfile(steamId64);
  const token = signSteamSession(user);

  const response = NextResponse.redirect(`${origin}/`, 302);
  response.cookies.set(STEAM_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: STEAM_SESSION_TTL_SECONDS,
  });

  return response;
}
