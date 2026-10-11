import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Branded favicon (spec §53) — generated, not a raster placeholder. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1A1511 0%, #0A0A0A 100%)",
          borderRadius: 7,
          border: "1.5px solid #FFD400",
        }}
      >
        <span
          style={{
            color: "#FFD400",
            fontSize: 19,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          P
        </span>
      </div>
    ),
    { ...size },
  );
}
