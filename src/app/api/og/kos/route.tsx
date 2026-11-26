import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

const ALLOWED_AVATAR_HOSTS = new Set([
  "avatars.steamstatic.com",
  "avatars.akamai.steamstatic.com",
  "steamcdn-a.akamaihd.net",
  "cdn.akamai.steamstatic.com",
]);

function sanitizeAvatarUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (!ALLOWED_AVATAR_HOSTS.has(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function clampText(raw: string | null, fallback: string, maxLen: number): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const name = clampText(sp.get("name"), "TARGET", 28).toUpperCase();
  const delta = clampText(sp.get("delta"), "-$0.00", 24);
  const share = clampText(sp.get("share"), "0.0%", 12);
  const targetShare = clampText(sp.get("target"), "16.7%", 12);
  const groupAvg = clampText(sp.get("avg"), "$0.00", 24);
  const familyName = clampText(sp.get("family"), "STEAM FAMILY", 36).toUpperCase();
  const avatarUrl = sanitizeAvatarUrl(sp.get("avatar"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#14060B",
          color: "#FFFFFF",
          position: "relative",
          padding: "36px 42px 34px 48px",
          fontFamily: "sans-serif",
          border: "2px solid #3D0E1B",
        }}
      >
        {/* Left BelTeez Crimson vertical bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "8px",
            backgroundColor: "#E8002D",
            display: "flex",
          }}
        />

        {/* Top Section: KOS Badge + Target Name + Delta */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                backgroundColor: "#E8002D",
                padding: "7px 16px",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: "#FFFFFF",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8" stroke="#FFFFFF" strokeWidth="2.4" />
                <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
                <line x1="12" y1="1" x2="12" y2="5" stroke="#FFFFFF" strokeWidth="2.4" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="#FFFFFF" strokeWidth="2.4" />
                <line x1="1" y1="12" x2="5" y2="12" stroke="#FFFFFF" strokeWidth="2.4" />
                <line x1="19" y1="12" x2="23" y2="12" stroke="#FFFFFF" strokeWidth="2.4" />
              </svg>
              <span>KILL ON SIGHT // UP NEXT TO BUY</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: name.length > 14 ? "44px" : "60px",
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: "0.04em",
              color: "#FFFFFF",
              marginTop: "4px",
            }}
          >
            {name}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: "#E8002D",
                letterSpacing: "0.04em",
              }}
            >
              {delta}
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#A1A1AA",
                letterSpacing: "0.16em",
              }}
            >
              VS. AVG
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "18px",
              color: "#A1A1AA",
            }}
          >
            <span>Current share:</span>
            <span style={{ color: "#FFFFFF", fontWeight: 800 }}>{share}</span>
            <span>of</span>
            <span style={{ color: "#FFFFFF", fontWeight: 800 }}>
              {targetShare}
            </span>
            <span>target</span>
          </div>
        </div>

        {/* Center Target-Locked Crosshair Showcase */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "18px",
            marginTop: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "280px",
              height: "280px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Inner avatar box */}
            <div
              style={{
                width: "224px",
                height: "224px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #521323",
                backgroundColor: "#240812",
                overflow: "hidden",
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name}
                  width={224}
                  height={224}
                  style={{
                    width: "224px",
                    height: "224px",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "84px",
                    fontWeight: 900,
                    color: "#FFFFFF",
                  }}
                >
                  {name.slice(0, 2)}
                </span>
              )}

              {/* Crimson target-lock color tint over avatar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(232, 0, 45, 0.42)",
                  display: "flex",
                }}
              />
            </div>

            {/* SVG Target-Lock Reticle & Corner Brackets */}
            <svg
              width="280"
              height="280"
              viewBox="0 0 280 280"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
              }}
            >
              {/* 4 Corner Brackets */}
              <path
                d="M12 40 V12 H40 M240 12 H268 V40 M268 240 V268 H240 M40 268 H12 V240"
                stroke="#E8002D"
                strokeWidth="4.5"
                fill="none"
              />
              {/* Dashed Outer Targeting Circle */}
              <circle
                cx="140"
                cy="140"
                r="96"
                stroke="#E8002D"
                strokeWidth="3"
                strokeDasharray="12 8"
                fill="none"
              />
              {/* Inner Bullseye Ring */}
              <circle
                cx="140"
                cy="140"
                r="26"
                stroke="#E8002D"
                strokeWidth="3.5"
                fill="none"
              />
              {/* 4 Cardinal Crosshair Lines */}
              <line x1="140" y1="22" x2="140" y2="92" stroke="#E8002D" strokeWidth="3.5" />
              <line x1="140" y1="188" x2="140" y2="258" stroke="#E8002D" strokeWidth="3.5" />
              <line x1="22" y1="140" x2="92" y2="140" stroke="#E8002D" strokeWidth="3.5" />
              <line x1="188" y1="140" x2="258" y2="140" stroke="#E8002D" strokeWidth="3.5" />
            </svg>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.26em",
              color: "#E8002D",
            }}
          >
            TARGET LOCKED // CONTRIBUTION DUE
          </div>
        </div>

        {/* Bottom Stats Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            borderTop: "2px solid #3D0E1B",
            paddingTop: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.18em",
                  color: "#A1A1AA",
                }}
              >
                GROUP AVG
              </span>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                {groupAvg}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.18em",
                  color: "#A1A1AA",
                }}
              >
                EQUAL TARGET
              </span>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                {targetShare}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              letterSpacing: "0.16em",
              color: "#71717A",
            }}
          >
            <span>{familyName}</span>
            <span>STEAMFT.COM</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 560,
      height: 820,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
