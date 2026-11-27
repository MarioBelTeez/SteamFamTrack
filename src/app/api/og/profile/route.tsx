import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { fetchSteamProfileFlex } from "@/lib/steam";
import { STEAM_REGIONS, type SteamRegion } from "@/lib/types";

function parseRegion(value: string | null): SteamRegion {
  if (value && value in STEAM_REGIONS) {
    return value as SteamRegion;
  }
  return "ma";
}

function fmtMoney(val: number, region: SteamRegion): string {
  const sym = STEAM_REGIONS[region].symbol;
  if (region === "jp") return `${sym}${Math.round(val).toLocaleString()}`;
  return `${sym}${val.toFixed(2)}`;
}

function clamp(text: string, max: number): string {
  const s = text.trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.STEAM_API_KEY?.trim();
  const query = (
    req.nextUrl.searchParams.get("query") ||
    req.nextUrl.searchParams.get("steamId64") ||
    ""
  ).trim();
  const region = parseRegion(req.nextUrl.searchParams.get("region"));

  if (!apiKey || !query) {
    return new Response("Missing query or STEAM_API_KEY", { status: 400 });
  }

  let profile;
  try {
    profile = await fetchSteamProfileFlex(query, region, apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Profile lookup failed";
    return new Response(msg, { status: 400 });
  }

  const regionCfg = STEAM_REGIONS[region];
  const topValue = profile.topValueGames.slice(0, 5);
  const topPlayed = profile.topPlayedGames.slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#08060A",
          color: "#FFFFFF",
          padding: "36px 44px",
          fontFamily: "sans-serif",
          border: "3px solid #2A161D",
          position: "relative",
        }}
      >
        {/* Left crimson accent rail */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "10px",
            backgroundColor: "#E8002D",
            display: "flex",
          }}
        />

        {/* Header Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            <div
              style={{
                width: "96px",
                height: "96px",
                border: "4px solid #E8002D",
                backgroundColor: "#140D12",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.personaName}
                  width={96}
                  height={96}
                  style={{ width: "96px", height: "96px", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "36px", fontWeight: 900 }}>
                  {profile.personaName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "#E8002D",
                    color: "#FFFFFF",
                    padding: "4px 12px",
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                  }}
                >
                  STEAMFT PROFILE FLEX
                </div>
                {profile.steamLevel !== null && (
                  <div
                    style={{
                      display: "flex",
                      border: "1px solid #E8002D",
                      backgroundColor: "#1A0A10",
                      color: "#FFFFFF",
                      padding: "4px 12px",
                      fontSize: "13px",
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                    }}
                  >
                    LVL {profile.steamLevel}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: "44px",
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  lineHeight: 1.05,
                }}
              >
                {clamp(profile.personaName, 24)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "#A1A1AA",
              }}
            >
              STEAMFT.COM
            </div>
            <div
              style={{
                display: "flex",
                border: "1px solid #3F2730",
                backgroundColor: "#140D12",
                padding: "5px 12px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#E4E4E7",
              }}
            >
              {regionCfg.code.toUpperCase()} · {regionCfg.currency}
            </div>
          </div>
        </div>

        {/* 4-Card Stats Strip */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          {[
            {
              label: "CATALOG VALUE",
              value: fmtMoney(profile.totalRawValue, region),
              accent: true,
            },
            {
              label: "SHAREABLE GAMES",
              value: `${profile.shareableGames} / ${profile.totalGames}`,
              accent: false,
            },
            {
              label: "TOTAL PLAYTIME",
              value: `${profile.totalPlaytimeHours.toLocaleString()}h`,
              accent: false,
            },
            {
              label: "AVG / GAME",
              value: fmtMoney(profile.avgGameValue, region),
              accent: false,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "14px 18px",
                backgroundColor: "#120C10",
                border: stat.accent ? "2px solid #E8002D" : "1px solid #2D1F25",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: "#A1A1AA",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 900,
                  color: stat.accent ? "#E8002D" : "#FFFFFF",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Two Tables: Top Value & Most Played */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginTop: "20px",
            flex: 1,
          }}
        >
          {/* Left Table: Top Valuable */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#110B0F",
              border: "1px solid #2D1F25",
              padding: "16px 20px",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                color: "#E8002D",
                borderBottom: "1px solid #2D1F25",
                paddingBottom: "8px",
              }}
            >
              TOP VALUABLE GAMES
            </div>
            {topValue.length === 0 ? (
              <div style={{ fontSize: "15px", color: "#71717A" }}>
                No paid games found
              </div>
            ) : (
              topValue.map((g, idx) => (
                <div
                  key={g.appid}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "16px",
                  }}
                >
                  <span style={{ color: "#F4F4F5", fontWeight: 600 }}>
                    {idx + 1}. {clamp(g.name, 28)}
                  </span>
                  <span style={{ color: "#E8002D", fontWeight: 800 }}>
                    {fmtMoney(g.rawPrice, region)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Right Table: Most Played */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#110B0F",
              border: "1px solid #2D1F25",
              padding: "16px 20px",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                color: "#38BDF8",
                borderBottom: "1px solid #2D1F25",
                paddingBottom: "8px",
              }}
            >
              MOST PLAYED GAMES
            </div>
            {topPlayed.length === 0 ? (
              <div style={{ fontSize: "15px", color: "#71717A" }}>
                Playtime hidden or 0h
              </div>
            ) : (
              topPlayed.map((g, idx) => (
                <div
                  key={g.appid}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "16px",
                  }}
                >
                  <span style={{ color: "#F4F4F5", fontWeight: 600 }}>
                    {idx + 1}. {clamp(g.name, 28)}
                  </span>
                  <span style={{ color: "#38BDF8", fontWeight: 800 }}>
                    {g.playtimeHours.toLocaleString()}h
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
    }
  );
}
