import type { DiscordSDK } from "@discord/embedded-app-sdk";
import type { SteamSessionUser } from "@/lib/steam-auth";

export const DISCORD_ACTIVITY_CLIENT_ID =
  process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID?.trim() || "1575252351776989296";

export interface DiscordActivityAuthResult {
  linked: boolean;
  user?: SteamSessionUser;
  discordUser?: {
    id: string;
    username: string;
    globalName: string | null;
  };
  linkToken?: string;
  error?: string;
}

export function isDiscordActivityEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has("frame_id") ||
    window.location.hostname.endsWith(".discordsays.com")
  );
}

let cachedSdkPromise: Promise<DiscordSDK> | null = null;
let urlMappingsPatched = false;

export const STEAM_CDN_URL_MAPPINGS = [
  { prefix: "/steam-avatars", target: "avatars.steamstatic.com" },
  { prefix: "/steam-fastly", target: "shared.fastly.steamstatic.com" },
  { prefix: "/steam-akamai", target: "cdn.akamai.steamstatic.com" },
  { prefix: "/steam-store", target: "store.akamai.steamstatic.com" },
];

export async function patchDiscordActivityUrls(): Promise<void> {
  if (urlMappingsPatched || !isDiscordActivityEnvironment()) return;
  urlMappingsPatched = true;
  try {
    const { patchUrlMappings } = await import("@discord/embedded-app-sdk");
    patchUrlMappings(STEAM_CDN_URL_MAPPINGS, {
      patchSrcAttributes: true,
      patchFetch: false,
      patchWebSocket: false,
      patchXhr: false,
    });
  } catch {
    urlMappingsPatched = false;
  }
}

export async function getDiscordSdk(): Promise<DiscordSDK> {
  if (!cachedSdkPromise) {
    cachedSdkPromise = (async () => {
      await patchDiscordActivityUrls();
      const { DiscordSDK: SdkClass } = await import(
        "@discord/embedded-app-sdk"
      );
      const sdk = new SdkClass(DISCORD_ACTIVITY_CLIENT_ID);
      await sdk.ready();
      return sdk;
    })();
  }
  return cachedSdkPromise;
}

export async function authorizeDiscordActivity(): Promise<{
  sdk: DiscordSDK;
  auth: DiscordActivityAuthResult;
}> {
  const sdk = await getDiscordSdk();

  const { code } = await sdk.commands.authorize({
    client_id: DISCORD_ACTIVITY_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  const res = await fetch("/api/auth/discord-activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = (await res.json().catch(() => ({}))) as DiscordActivityAuthResult;
  if (!res.ok) {
    throw new Error(
      data.error || `Discord Activity authentication failed (${res.status})`
    );
  }

  return { sdk, auth: data };
}

export async function openExternalUrl(
  url: string,
  sdk?: DiscordSDK | null
): Promise<void> {
  if (sdk) {
    try {
      await sdk.commands.openExternalLink({ url });
      return;
    } catch {
      // Fall back to browser window.open if openExternalLink is unavailable
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
