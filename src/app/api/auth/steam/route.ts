import { NextRequest, NextResponse } from "next/server";
import {
  buildSteamOpenIdUrl,
  getPublicOrigin,
  verifyDiscordLinkToken,
} from "@/lib/steam-auth";

export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const discordLinkToken = req.nextUrl.searchParams.get("discord_link");

  if (discordLinkToken) {
    const verified = verifyDiscordLinkToken(discordLinkToken);
    if (!verified) {
      return new NextResponse(
        `<!doctype html><html><body style="background:#08060A;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:440px;padding:28px;border:1px solid #E8002D;background:#110C0F"><h1 style="margin:0 0 12px;color:#E8002D;font-size:20px">DISCORD LINK EXPIRED</h1><p style="margin:0;color:#ccc;line-height:1.5">This verification link is invalid or expired (links last 10 minutes). Run <code>/link</code> again in Discord to get a fresh link.</p></div></body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const returnToPath = `/api/auth/steam/callback?discord_link=${encodeURIComponent(
      discordLinkToken
    )}`;
    const redirectUrl = buildSteamOpenIdUrl(origin, returnToPath);
    return NextResponse.redirect(redirectUrl, 302);
  }

  const redirectUrl = buildSteamOpenIdUrl(origin);
  return NextResponse.redirect(redirectUrl, 302);
}
