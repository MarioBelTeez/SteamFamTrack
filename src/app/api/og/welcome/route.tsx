import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

const ALLOWED_AVATAR_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
]);

function sanitizeAvatar(raw: string | null): string | null {
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

function clamp(raw: string | null, fallback: string, max: number): string {
  const s = (raw || "").trim();
  return s ? s.slice(0, max) : fallback;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const username = clamp(sp.get("name"), "NEW MEMBER", 26).toUpperCase();
  const memberNum = clamp(sp.get("count"), "195", 8);
  const avatarUrl = sanitizeAvatar(sp.get("avatar"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#08060A",
          color: "#FFFFFF",
          position: "relative",
          padding: "40px 56px",
          fontFamily: "sans-serif",
          overflow: "hidden",
          border: "3px solid #2A161D",
        }}
      >
        {/* Left crimson vertical stripe */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "12px",
            backgroundColor: "#E8002D",
            display: "flex",
          }}
        />

        {/* Persona-style diagonal crimson right slash */}
        <svg
          width="420"
          height="420"
          viewBox="0 0 420 420"
          style={{ position: "absolute", right: 0, top: 0 }}
        >
          <polygon points="180,0 420,0 420,420 60,420" fill="#16070D" />
          <polygon points="180,0 202,0 82,420 60,420" fill="#E8002D" />
          <polygon points="340,0 420,0 420,95" fill="#E8002D" />
        </svg>

        {/* Left: Circular Avatar inside glowing BelTeez ring + Member Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "36px",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "184px",
              height: "184px",
              borderRadius: "9999px",
              border: "6px solid #E8002D",
              backgroundColor: "#14080E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 0 40px rgba(232, 0, 45, 0.45)",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={username}
                width={172}
                height={172}
                style={{
                  width: "172px",
                  height: "172px",
                  objectFit: "cover",
                  borderRadius: "9999px",
                }}
              />
            ) : (
              <span style={{ fontSize: "72px", fontWeight: 900, color: "#FFFFFF" }}>
                {username.slice(0, 2)}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxWidth: "560px",
            }}
          >
            <div
              style={{
                display: "flex",
                backgroundColor: "#E8002D",
                color: "#FFFFFF",
                padding: "6px 16px",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "0.2em",
                alignSelf: "flex-start",
              }}
            >
              WELCOME TO BELTEEZ STUDIO
            </div>

            <div
              style={{
                display: "flex",
                fontSize: username.length > 14 ? "44px" : "58px",
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: "0.03em",
                color: "#FFFFFF",
              }}
            >
              {username}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#D4D4D8",
              }}
            >
              <span style={{ color: "#E8002D" }}>MEMBER #{memberNum}</span>
              <span style={{ color: "#52525B" }}>{"//"}</span>
              <span>BELTEEZ.STUDIO • STEAMFT.COM</span>
            </div>
          </div>
        </div>

        {/* Right: Crisp BelTeez [ B ] Brand Emblem (Satori-native flex box) */}
        <div
          style={{
            width: "116px",
            height: "116px",
            backgroundColor: "#050406",
            border: "5px solid #FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "84px",
              height: "84px",
              border: "7px solid #E8002D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "54px",
              fontWeight: 900,
              color: "#E8002D",
              lineHeight: 1,
            }}
          >
            B
          </div>
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 360,
      headers: { "Cache-Control": "public, max-age=60" },
    }
  );
}
