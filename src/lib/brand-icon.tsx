import { ImageResponse } from "next/og";

/**
 * The branded "P" favicon at any pixel size (spec §53) -- generated, not a
 * raster placeholder. Used by app/icon.tsx and the /favicon.ico route so
 * every request for the site icon returns the same picture.
 */
export function brandIconResponse(px: number): ImageResponse {
  const k = px / 32;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1A1511 0%, #0A0A0A 100%)",
        borderRadius: 7 * k,
        border: `${1.5 * k}px solid #FFD400`,
      }}
    >
      <span
        style={{
          color: "#FFD400",
          fontSize: 19 * k,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        P
      </span>
    </div>,
    { width: px, height: px },
  );
}
