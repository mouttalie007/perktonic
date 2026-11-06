/** POSTs to our own API route and returns either data or a message that is safe to show. */
export async function postJson<T>(endpoint: string, body: unknown, signal: AbortSignal): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (err) {
    if (signal.aborted) return { ok: false, message: "Check cancelled." };
    return { ok: false, message: err instanceof TypeError ? "Could not reach the checker. Check your internet connection and try again." : "The request failed." };
  }
  try {
    const json = (await res.json()) as { ok: boolean; data?: T; error?: { message?: string } };
    if (json.ok && json.data) return { ok: true, data: json.data };
    return { ok: false, message: json.error?.message ?? "The check failed." };
  } catch {
    return { ok: false, message: `The checker answered with an unexpected response (HTTP ${res.status}). Please try again.` };
  }
}

export function saveFile(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
