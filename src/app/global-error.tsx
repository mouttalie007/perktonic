"use client";

/**
 * Last-resort fallback if the root layout itself throws. Must render its own
 * <html>/<body> and stay dependency-free (inline styles, no Tailwind) since
 * it may run when normal app chrome has failed to load (spec §54, §87).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#ffffff",
          color: "#111111",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#707070",
              textTransform: "uppercase",
            }}
          >
            PerkTonic
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>
            Something went wrong.
          </h1>
          <p style={{ color: "#707070", marginTop: 8, maxWidth: 380 }}>
            Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: "#111111",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
