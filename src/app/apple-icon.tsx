import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          border: "5px solid #FFD400",
        }}
      >
        <span
          style={{
            color: "#FFD400",
            fontSize: 100,
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
