import { NextRequest, NextResponse } from "next/server";
import {
  STEAM_SESSION_COOKIE,
  buildSteamSessionCookieOptions,
  fetchSteamUserProfile,
  getPublicOrigin,
  signSteamSession,
  verifyDiscordLinkToken,
  verifySteamOpenIdCallback,
} from "@/lib/steam-auth";
import { getSteamFamDb } from "@/lib/supabase";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDiscordLinkHtml(opts: {
  ok: boolean;
  title: string;
  body: string;
  dashboardUrl: string;
}): string {
  const accent = opts.ok ? "#22C55E" : "#E8002D";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)} — SteamFamTrack</title>
</head>
<body style="background:#08060A;color:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px">
  <div style="max-width:460px;width:100%;padding:28px;border:1px solid ${accent};background:#110C0F;box-shadow:0 20px 60px rgba(0,0,0,0.6)">
    <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:8px">STEAMFAMTRACK // DISCORD VERIFICATION</div>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.2">${escapeHtml(opts.title)}</h1>
    <p style="margin:0 0 22px;color:#CBD5E1;line-height:1.6;font-size:14px">${opts.body}</p>
    <a href="${escapeHtml(opts.dashboardUrl)}" style="display:inline-block;background:#E8002D;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;padding:10px 18px">Open SteamFamTrack</a>
  </div>
</body>
</html>`;
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

  const discordLinkToken = url.searchParams.get("discord_link");
  if (discordLinkToken) {
    const verifiedLink = verifyDiscordLinkToken(discordLinkToken);
    if (!verifiedLink) {
      return new NextResponse(
        renderDiscordLinkHtml({
          ok: false,
          title: "Verification Link Expired",
          body: "Your Discord link token is invalid or expired (links last 10 minutes). Run <code>/link</code> again in Discord.",
          dashboardUrl: `${origin}/`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const db = getSteamFamDb();
    if (!db) {
      return new NextResponse(
        renderDiscordLinkHtml({
          ok: false,
          title: "Database Unavailable",
          body: "Could not connect to SteamFamTrack storage to save your Discord link. Please try again shortly.",
          dashboardUrl: `${origin}/`,
        }),
        {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const { error } = await db.from("discord_links").upsert(
      {
        discord_user_id: verifiedLink.discordUserId,
        steam_input: user.profileUrl,
        steam_id64: steamId64,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "discord_user_id" }
    );

    if (error) {
      return new NextResponse(
        renderDiscordLinkHtml({
          ok: false,
          title: "Failed to Link Discord",
          body: escapeHtml(error.message),
          dashboardUrl: `${origin}/`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const htmlResponse = new NextResponse(
      renderDiscordLinkHtml({
        ok: true,
        title: "Steam Account Verified & Linked",
        body: `Linked <strong>${escapeHtml(user.personaName)}</strong> (<code>${escapeHtml(
          steamId64
        )}</code>) to your Discord account.<br/><br/>You can close this tab and run <code>/family board</code> in Discord.`,
        dashboardUrl: `${origin}/`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
    htmlResponse.cookies.set(
      STEAM_SESSION_COOKIE,
      token,
      buildSteamSessionCookieOptions(origin)
    );
    return htmlResponse;
  }

  const response = NextResponse.redirect(`${origin}/`, 302);
  response.cookies.set(
    STEAM_SESSION_COOKIE,
    token,
    buildSteamSessionCookieOptions(origin)
  );

  return response;
}
