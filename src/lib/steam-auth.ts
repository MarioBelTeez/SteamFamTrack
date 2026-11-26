import crypto from "node:crypto";

export const STEAM_SESSION_COOKIE = "sft_steam_session";
export const STEAM_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const STEAM_SESSION_TTL_MS = STEAM_SESSION_TTL_SECONDS * 1000;
export const DISCORD_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const OPENID_IDENTIFIER_SELECT =
  "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID_REGEX =
  /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})\/?$/;

export interface SteamSessionUser {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

interface SignedSessionPayload extends SteamSessionUser {
  exp: number;
}

function getSessionSecret(override?: string): string {
  if (override) return override;
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STEAM_API_KEY ||
    "local-dev-fallback"
  );
}

function computeSignature(payloadB64: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
}

export function signSteamSession(
  user: SteamSessionUser,
  secret?: string
): string {
  const payload: SignedSessionPayload = {
    steamId64: user.steamId64,
    personaName: user.personaName,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    exp: Date.now() + STEAM_SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sigB64 = computeSignature(payloadB64, getSessionSecret(secret));
  return `${payloadB64}.${sigB64}`;
}

export function verifySteamSession(
  token: string | undefined,
  secret?: string
): SteamSessionUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSigB64 = computeSignature(payloadB64, getSessionSecret(secret));
  const actualBuf = Buffer.from(sigB64, "utf8");
  const expectedBuf = Buffer.from(expectedSigB64, "utf8");

  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<SignedSessionPayload>;

    if (
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }

    if (
      typeof parsed.steamId64 !== "string" ||
      !parsed.steamId64 ||
      typeof parsed.personaName !== "string" ||
      typeof parsed.avatarUrl !== "string" ||
      typeof parsed.profileUrl !== "string"
    ) {
      return null;
    }

    return {
      steamId64: parsed.steamId64,
      personaName: parsed.personaName,
      avatarUrl: parsed.avatarUrl,
      profileUrl: parsed.profileUrl,
    };
  } catch {
    return null;
  }
}

export interface DiscordLinkPayload {
  discordUserId: string;
  exp: number;
}

function getDiscordLinkSecret(override?: string): string {
  if (override) return override;
  return (
    process.env.DISCORD_LINK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    getSessionSecret()
  );
}

export function signDiscordLinkToken(
  discordUserId: string,
  secret?: string
): string {
  const payload: DiscordLinkPayload = {
    discordUserId,
    exp: Date.now() + DISCORD_LINK_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sigB64 = computeSignature(payloadB64, getDiscordLinkSecret(secret));
  return `${payloadB64}.${sigB64}`;
}

export function verifyDiscordLinkToken(
  token: string | undefined | null,
  secret?: string
): { discordUserId: string } | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSigB64 = computeSignature(
    payloadB64,
    getDiscordLinkSecret(secret)
  );
  const actualBuf = Buffer.from(sigB64, "utf8");
  const expectedBuf = Buffer.from(expectedSigB64, "utf8");

  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<DiscordLinkPayload>;

    if (
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }

    if (
      typeof parsed.discordUserId !== "string" ||
      !/^\d{15,25}$/.test(parsed.discordUserId)
    ) {
      return null;
    }

    return { discordUserId: parsed.discordUserId };
  } catch {
    return null;
  }
}

export function buildSteamOpenIdUrl(
  origin: string,
  returnToPath = "/api/auth/steam/callback"
): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const normalizedPath = returnToPath.startsWith("/")
    ? returnToPath
    : `/${returnToPath}`;
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": `${normalizedOrigin}${normalizedPath}`,
    "openid.realm": normalizedOrigin,
    "openid.identity": OPENID_IDENTIFIER_SELECT,
    "openid.claimed_id": OPENID_IDENTIFIER_SELECT,
  });

  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export function extractSteamIdFromClaimedId(
  claimedId: string | null
): string | null {
  if (!claimedId) return null;
  const match = claimedId.trim().match(CLAIMED_ID_REGEX);
  return match ? match[1] : null;
}

export async function verifySteamOpenIdCallback(
  searchParams: URLSearchParams
): Promise<string | null> {
  const steamId64 = extractSteamIdFromClaimedId(
    searchParams.get("openid.claimed_id")
  );
  if (!steamId64) return null;

  const verificationParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("openid.")) {
      verificationParams.set(key, value);
    }
  }
  verificationParams.set("openid.mode", "check_authentication");

  try {
    const res = await fetch(STEAM_OPENID_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verificationParams.toString(),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const text = await res.text();
    const isValid = text
      .split(/\r?\n/)
      .some((line) => line.trim() === "is_valid:true");

    return isValid ? steamId64 : null;
  } catch {
    return null;
  }
}

export function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();

  if (forwardedHost) {
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : "https";
    return `${proto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  return new URL(req.url).origin.replace(/\/+$/, "");
}

export function buildSteamSessionCookieOptions(
  origin: string,
  crossSite = false
) {
  const isHttps = origin.startsWith("https://");
  return {
    httpOnly: true,
    sameSite: (crossSite && isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps,
    path: "/",
    maxAge: STEAM_SESSION_TTL_SECONDS,
  };
}

export async function fetchSteamUserProfile(
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
