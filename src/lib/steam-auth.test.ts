import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const {
  STEAM_SESSION_COOKIE,
  signSteamSession,
  verifySteamSession,
  signDiscordLinkToken,
  verifyDiscordLinkToken,
  buildSteamOpenIdUrl,
  extractSteamIdFromClaimedId,
  verifySteamOpenIdCallback,
  getPublicOrigin,
} = (await import(`./steam-auth${".ts"}`)) as typeof import("./steam-auth");

const SAMPLE_USER = {
  steamId64: "76561198012345678",
  personaName: "TeezPlayer",
  avatarUrl: "https://avatars.steamstatic.com/sample_full.jpg",
  profileUrl: "https://steamcommunity.com/profiles/76561198012345678/",
};

describe("steam session signing & verification", () => {
  it("exports the expected session cookie name", () => {
    assert.equal(STEAM_SESSION_COOKIE, "sft_steam_session");
  });

  it("round-trips a valid signed session token", () => {
    const secret = "test-secret-123";
    const token = signSteamSession(SAMPLE_USER, secret);
    const verified = verifySteamSession(token, secret);

    assert.deepEqual(verified, SAMPLE_USER);
  });

  it("rejects a tampered token payload or signature", () => {
    const secret = "test-secret-123";
    const token = signSteamSession(SAMPLE_USER, secret);
    const [payloadB64, sigB64] = token.split(".");

    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...SAMPLE_USER,
        steamId64: "76561198099999999",
        exp: Date.now() + 60_000,
      }),
      "utf8"
    ).toString("base64url");

    assert.equal(
      verifySteamSession(`${tamperedPayload}.${sigB64}`, secret),
      null
    );

    const flippedSig =
      (sigB64[0] === "a" ? "b" : "a") + sigB64.slice(1);
    assert.equal(verifySteamSession(`${payloadB64}.${flippedSig}`, secret), null);
    assert.equal(verifySteamSession("not-a-valid-token", secret), null);
    assert.equal(verifySteamSession(undefined, secret), null);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSteamSession(SAMPLE_USER, "secret-A");
    assert.equal(verifySteamSession(token, "secret-B"), null);
  });

  it("rejects an expired token", () => {
    const secret = "test-secret-expired";
    const expiredPayload = Buffer.from(
      JSON.stringify({
        ...SAMPLE_USER,
        exp: Date.now() - 1000,
      }),
      "utf8"
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", secret)
      .update(expiredPayload)
      .digest("base64url");

    assert.equal(verifySteamSession(`${expiredPayload}.${sig}`, secret), null);
  });
});

describe("extractSteamIdFromClaimedId", () => {
  it("extracts 17-digit SteamID64 from valid Steam OpenID claimed_id URLs", () => {
    assert.equal(
      extractSteamIdFromClaimedId(
        "https://steamcommunity.com/openid/id/76561198012345678"
      ),
      "76561198012345678"
    );
    assert.equal(
      extractSteamIdFromClaimedId(
        "http://steamcommunity.com/openid/id/76561198012345678/"
      ),
      "76561198012345678"
    );
  });

  it("rejects invalid or spoofed claimed_id values", () => {
    assert.equal(extractSteamIdFromClaimedId(null), null);
    assert.equal(extractSteamIdFromClaimedId(""), null);
    assert.equal(
      extractSteamIdFromClaimedId(
        "https://evil.example/openid/id/76561198012345678"
      ),
      null
    );
    assert.equal(
      extractSteamIdFromClaimedId(
        "https://steamcommunity.com/openid/id/12345"
      ),
      null
    );
    assert.equal(
      extractSteamIdFromClaimedId(
        "https://steamcommunity.com/openid/id/76561198012345678/extra"
      ),
      null
    );
  });
});

describe("buildSteamOpenIdUrl", () => {
  it("builds a compliant Steam OpenID 2.0 checkid_setup redirect URL", () => {
    const rawUrl = buildSteamOpenIdUrl("https://steamfam.belteez.studio/");
    const parsed = new URL(rawUrl);

    assert.equal(parsed.origin + parsed.pathname, "https://steamcommunity.com/openid/login");
    assert.equal(
      parsed.searchParams.get("openid.ns"),
      "http://specs.openid.net/auth/2.0"
    );
    assert.equal(parsed.searchParams.get("openid.mode"), "checkid_setup");
    assert.equal(
      parsed.searchParams.get("openid.return_to"),
      "https://steamfam.belteez.studio/api/auth/steam/callback"
    );
    assert.equal(
      parsed.searchParams.get("openid.realm"),
      "https://steamfam.belteez.studio"
    );
    assert.equal(
      parsed.searchParams.get("openid.identity"),
      "http://specs.openid.net/auth/2.0/identifier_select"
    );
    assert.equal(
      parsed.searchParams.get("openid.claimed_id"),
      "http://specs.openid.net/auth/2.0/identifier_select"
    );
  });
});

describe("verifySteamOpenIdCallback", () => {
  it("POSTs check_authentication and returns SteamID64 when Steam responds is_valid:true", async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody = "";

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const params = new URLSearchParams({
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.claimed_id":
          "https://steamcommunity.com/openid/id/76561198012345678",
        "openid.sig": "abc123",
      });

      const steamId = await verifySteamOpenIdCallback(params);
      assert.equal(steamId, "76561198012345678");

      const sent = new URLSearchParams(capturedBody);
      assert.equal(sent.get("openid.mode"), "check_authentication");
      assert.equal(sent.get("openid.sig"), "abc123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null when Steam responds is_valid:false", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n", {
        status: 200,
      })) as typeof fetch;

    try {
      const params = new URLSearchParams({
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.claimed_id":
          "https://steamcommunity.com/openid/id/76561198012345678",
      });

      assert.equal(await verifySteamOpenIdCallback(params), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("getPublicOrigin", () => {
  it("uses x-forwarded-proto and x-forwarded-host when present", () => {
    const req = new Request("http://127.0.0.1:3000/api/auth/steam", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "steamfam.vercel.app",
      },
    });
    assert.equal(getPublicOrigin(req), "https://steamfam.vercel.app");
  });

  it("falls back to request URL origin when proxy headers are absent", () => {
    const req = new Request("http://localhost:3000/api/auth/steam");
    assert.equal(getPublicOrigin(req), "http://localhost:3000");
  });
});

describe("discord link token signing & verification", () => {
  it("round-trips a valid Discord link token", () => {
    const secret = "discord-link-secret";
    const token = signDiscordLinkToken("123456789012345678", secret);
    assert.deepEqual(verifyDiscordLinkToken(token, secret), {
      discordUserId: "123456789012345678",
    });
  });

  it("rejects tampered, wrong-secret, or expired Discord link tokens", () => {
    const secret = "discord-link-secret";
    const token = signDiscordLinkToken("123456789012345678", secret);
    assert.equal(verifyDiscordLinkToken(token, "other-secret"), null);
    assert.equal(verifyDiscordLinkToken(`${token}x`, secret), null);

    const expiredPayload = Buffer.from(
      JSON.stringify({ discordUserId: "123456789012345678", exp: Date.now() - 1000 }),
      "utf8"
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", secret)
      .update(expiredPayload)
      .digest("base64url");
    assert.equal(verifyDiscordLinkToken(`${expiredPayload}.${sig}`, secret), null);
  });

  it("supports custom returnToPath in buildSteamOpenIdUrl", () => {
    const url = new URL(
      buildSteamOpenIdUrl(
        "https://steamfam.example",
        "/api/auth/steam/callback?discord_link=abc"
      )
    );
    assert.equal(
      url.searchParams.get("openid.return_to"),
      "https://steamfam.example/api/auth/steam/callback?discord_link=abc"
    );
  });
});
