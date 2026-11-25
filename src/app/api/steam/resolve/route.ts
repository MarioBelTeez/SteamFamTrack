import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveSteamProfilePreview } from "@/lib/steam";

interface ResolveSteamRequestBody {
  input?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    let body: ResolveSteamRequestBody;
    try {
      body = (await req.json()) as ResolveSteamRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const input = typeof body?.input === "string" ? body.input.trim() : "";
    if (!input) {
      return NextResponse.json(
        { error: "Steam profile URL, vanity name, or SteamID64 is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "STEAM_API_KEY is not configured on the server. Add it to .env.local to verify Steam profiles.",
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(req.headers);
    const rl = checkRateLimit(`steam-resolve:${ip}`, 40, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit reached for Steam profile lookups. Try again in ${rl.resetInSeconds}s.`,
        },
        { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
      );
    }

    const preview = await resolveSteamProfilePreview(input, apiKey);
    return NextResponse.json(preview, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve Steam profile";
    const status = message.includes("Could not resolve Steam vanity URL")
      ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
