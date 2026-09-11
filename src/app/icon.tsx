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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          borderRadius: 7,
        }}
      >
        <span
          style={{
            color: "#FFD400",
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size },
  );
}
