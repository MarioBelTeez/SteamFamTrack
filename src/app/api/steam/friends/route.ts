import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveSteamId64 } from "@/lib/steam";
import { STEAM_SESSION_COOKIE, verifySteamSession } from "@/lib/steam-auth";

const PRIVATE_FRIENDS_HINT =
  "Steam Friends List is Private. Set Steam Privacy → Friends List → Public, or paste friend URLs manually.";

const MAX_FRIENDS = 300;
const SUMMARY_BATCH_SIZE = 100;

interface RawSteamFriend {
  steamid?: string;
  relationship?: string;
  friend_since?: number;
}

interface RawSteamPlayer {
  steamid?: string;
  personaname?: string;
  avatarfull?: string;
  avatarmedium?: string;
  avatar?: string;
  profileurl?: string;
}

interface SteamFriendEntry {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  friendSince: number;
}

async function fetchPlayerSummariesBatch(
  steamIds: string[],
  apiKey: string
): Promise<Map<string, RawSteamPlayer>> {
  const map = new Map<string, RawSteamPlayer>();
  if (steamIds.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < steamIds.length; i += SUMMARY_BATCH_SIZE) {
    chunks.push(steamIds.slice(i, i + SUMMARY_BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(
        apiKey
      )}&steamids=${encodeURIComponent(chunk.join(","))}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [] as RawSteamPlayer[];
      const data = await res.json();
      return Array.isArray(data?.response?.players)
        ? (data.response.players as RawSteamPlayer[])
        : [];
    })
  );

  for (const batch of results) {
    for (const player of batch) {
      if (typeof player?.steamid === "string" && player.steamid) {
        map.set(player.steamid, player);
      }
    }
  }

  return map;
}

async function handleFriendsRequest(req: NextRequest, inputParam: string) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`steam-friends:${ip}`, 25, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit reached for Steam friends lookups. Try again in ${rl.resetInSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "STEAM_API_KEY is not configured on the server. Add it to .env.local to load Steam friends.",
      },
      { status: 400 }
    );
  }

  try {
    let steamId64: string | null = null;

    if (inputParam) {
      steamId64 = await resolveSteamId64(inputParam, apiKey);
    } else {
      const sessionToken = req.cookies.get(STEAM_SESSION_COOKIE)?.value;
      const sessionUser = verifySteamSession(sessionToken);
      steamId64 = sessionUser?.steamId64 ?? null;
    }

    if (!steamId64) {
      return NextResponse.json(
        {
          error:
            "Sign in with Steam or provide a Steam profile URL, vanity name, or SteamID64.",
        },
        { status: 400 }
      );
    }

    const friendsUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${encodeURIComponent(
      apiKey
    )}&steamid=${encodeURIComponent(steamId64)}&relationship=friend`;

    const res = await fetch(friendsUrl, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        {
          steamId64,
          isPrivate: true,
          friends: [],
          hint: PRIVATE_FRIENDS_HINT,
        },
        { status: 200 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          steamId64,
          isPrivate: true,
          friends: [],
          hint: PRIVATE_FRIENDS_HINT,
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    const rawFriends: unknown = data?.friendslist?.friends;

    if (!Array.isArray(rawFriends)) {
      return NextResponse.json(
        {
          steamId64,
          isPrivate: true,
          friends: [],
          hint: PRIVATE_FRIENDS_HINT,
        },
        { status: 200 }
      );
    }

    const capped = (rawFriends as RawSteamFriend[])
      .filter(
        (f): f is RawSteamFriend & { steamid: string } =>
          typeof f?.steamid === "string" && /^\d{17}$/.test(f.steamid)
      )
      .slice(0, MAX_FRIENDS);

    if (capped.length === 0) {
      return NextResponse.json(
        {
          steamId64,
          isPrivate: false,
          friends: [],
        },
        { status: 200 }
      );
    }

    const summaryMap = await fetchPlayerSummariesBatch(
      capped.map((f) => f.steamid),
      apiKey
    );

    const friends: SteamFriendEntry[] = capped
      .map((f) => {
        const player = summaryMap.get(f.steamid);
        return {
          steamId64: f.steamid,
          personaName:
            typeof player?.personaname === "string" &&
            player.personaname.trim()
              ? player.personaname
              : f.steamid,
          avatarUrl:
            typeof player?.avatarfull === "string"
              ? player.avatarfull
              : typeof player?.avatarmedium === "string"
                ? player.avatarmedium
                : typeof player?.avatar === "string"
                  ? player.avatar
                  : "",
          profileUrl:
            typeof player?.profileurl === "string" && player.profileurl.trim()
              ? player.profileurl
              : `https://steamcommunity.com/profiles/${f.steamid}`,
          friendSince:
            typeof f.friend_since === "number" ? f.friend_since : 0,
        };
      })
      .sort((a, b) =>
        a.personaName.localeCompare(b.personaName, undefined, {
          sensitivity: "base",
        })
      );

    return NextResponse.json(
      {
        steamId64,
        isPrivate: false,
        friends,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch Steam friends list";
    const status = message.includes("Could not resolve Steam vanity URL")
      ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input")?.trim() ?? "";
  return handleFriendsRequest(req, input);
}

interface FriendsPostBody {
  input?: unknown;
}

export async function POST(req: NextRequest) {
  let input = "";
  const rawBody = await req.text();
  if (rawBody.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawBody) as FriendsPostBody;
      if (typeof parsed?.input === "string") {
        input = parsed.input.trim();
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }
  }

  return handleFriendsRequest(req, input);
}
