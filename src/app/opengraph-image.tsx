import { ImageResponse } from "next/og";

export const alt =
  "SteamFamTrack — Steam Family Contribution Board, Overlap Heatmap, and Swap Simulator";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
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
          position: "relative",
          padding: "56px 68px",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left crimson vertical accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "14px",
            backgroundColor: "#E8002D",
            display: "flex",
          }}
        />

        {/* Diagonal Persona-style crimson corner slash */}
        <svg
          width="460"
          height="630"
          viewBox="0 0 460 630"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          <polygon points="220,0 460,0 460,630 60,630" fill="#14080E" />
          <polygon points="220,0 242,0 82,630 60,630" fill="#E8002D" />
          <polygon points="360,0 460,0 460,150" fill="#E8002D" />
        </svg>

        {/* Top Row: Brand badge + status pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            {/* Icon matching src/app/icon.svg */}
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <polygon
                points="2,2 50,2 62,14 62,62 2,62"
                fill="#08060A"
                stroke="#E8002D"
                strokeWidth="3"
              />
              <polygon points="48,2 62,16 62,2 48,2" fill="#E8002D" />
              <circle cx="40" cy="22" r="7" stroke="#E8002D" strokeWidth="3.2" />
              <path
                d="M31 35.5C33.5 32.5 36.8 31 40 31C46.6 31 52 36.2 52 43V45H35"
                stroke="#E8002D"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="24"
                cy="27"
                r="7.5"
                fill="#08060A"
                stroke="#FFFFFF"
                strokeWidth="3.4"
              />
              <path
                d="M11 49V46C11 38.8 16.8 34.5 24 34.5C31.2 34.5 37 38.8 37 46V49H11Z"
                fill="#08060A"
                stroke="#FFFFFF"
                strokeWidth="3.4"
                strokeLinejoin="round"
              />
            </svg>

            <div
              style={{
                display: "flex",
                backgroundColor: "#E8002D",
                color: "#FFFFFF",
                padding: "8px 18px",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.18em",
              }}
            >
              BELTEEZ STUDIO // FAMILY ANALYZER
            </div>
          </div>
        </div>

        {/* Center Hero Title + Subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            position: "relative",
            maxWidth: "960px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "4px",
                backgroundColor: "#E8002D",
                display: "flex",
              }}
            />
            <span
              style={{
                color: "#E8002D",
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "0.22em",
              }}
            >
              STEAM FAMILY INTELLIGENCE
            </span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "96px",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "0.04em",
              color: "#FFFFFF",
            }}
          >
            STEAMFAMTRACK
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#E4E4E7",
              marginTop: "4px",
            }}
          >
            STEAM FAMILY CONTRIBUTION BOARD • OVERLAP HEATMAP • SWAP SIMULATOR
          </div>
        </div>

        {/* Bottom Feature Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #27272A",
            paddingTop: "24px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                border: "2px solid #E8002D",
                backgroundColor: "#14080E",
                padding: "8px 16px",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#FFFFFF",
              }}
            >
              6-SLOT ROSTER
            </div>
            <div
              style={{
                display: "flex",
                border: "2px solid #27272A",
                backgroundColor: "#111015",
                padding: "8px 16px",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#D4D4D8",
              }}
            >
              365D COOLDOWN TRACKER
            </div>
            <div
              style={{
                display: "flex",
                border: "2px solid #27272A",
                backgroundColor: "#111015",
                padding: "8px 16px",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#D4D4D8",
              }}
            >
              WAITLIST IMPACT DIFF
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#A1A1AA",
            }}
          >
            STEAMFT.COM
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
