/** Runs once when the Node server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Tool 4.10: real storage and mail, and the 30-second sweep that raises the alerts.
    const { startHeartbeat } = await import("@/lib/tools/heartbeat");
    startHeartbeat();
  }
}
