import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social image (spec §53, §84) — used when a page sets none of its own. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -2,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Viral
          <span style={{ color: "#FFD400" }}>Trendly</span>
          .com
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 8,
            color: "rgba(255,255,255,0.55)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          TREND TODAY. TALK TOMORROW.
        </div>
      </div>
    ),
    { ...size },
  );
}
