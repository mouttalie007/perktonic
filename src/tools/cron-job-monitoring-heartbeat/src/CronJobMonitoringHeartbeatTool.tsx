"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE_MONITOR, SAMPLE_PING_URL } from "../fixtures/sample";
import { ACTIONS_PATH, MAX_EMAILS, MAX_NAME, PING_PATH, STORED_NOTE, TOOL_PATH } from "./limits";
import { describeSeconds } from "./logic/evaluate";
import { inZone, relative } from "./logic/time";
import type { ApiResponse, MonitorView, State } from "./types";
import { focusRing, btnPrimary, btnSecondary, inputCls, card } from "../../_shared/ui";

const label = "block text-sm font-medium text-slate-700";

const UNITS = [
  { id: "min", label: "minutes", sec: 60 },
  { id: "h", label: "hours", sec: 3600 },
  { id: "d", label: "days", sec: 86400 },
] as const;
type Unit = (typeof UNITS)[number]["id"];
const toSec = (n: number, u: Unit) => Math.round(n * UNITS.find((x) => x.id === u)!.sec);

const BADGE: Record<State, string> = { new: "bg-slate-100 text-slate-800", up: "bg-emerald-100 text-emerald-900", late: "bg-amber-100 text-amber-950", down: "bg-red-100 text-red-900" };
const STATE_TEXT: Record<State, string> = { new: "New: no ping yet", up: "Up", late: "Late (in the grace period)", down: "Down" };

async function call<T>(body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(ACTIONS_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return ((await res.json().catch(() => null)) as ApiResponse<T> | null) ?? { ok: false, error: { code: "bad_response", message: "The server did not answer properly. Please try again." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Could not reach the server. Check your connection and try again." } };
  }
}

function Copyable({ id, value, name }: { id: string; value: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor={id} className="sr-only">
        {name}
      </label>
      <input id={id} readOnly value={value} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={btnSecondary}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : `Copy ${name}`}
      </button>
    </div>
  );
}

function Dashboard({ m, demo, local, now, onAction, busy }: { m: MonitorView; demo: boolean; local: boolean; now: number | null; onAction?: (a: "view" | "pause" | "resume" | "test" | "delete") => void; busy: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const when = (iso: string | null) => (iso ? (local ? `${inZone(iso)}${now ? ` (${relative(iso, now)})` : ""}` : `${iso.slice(0, 16).replace("T", " ")} UTC`) : "—");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold" dir="auto">
          {m.name}
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE[m.state]}`}>{m.paused ? "Paused" : STATE_TEXT[m.state]}</span>
        {demo && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Demo monitor (read-only)</span>}
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">Expected every</dt>
          <dd>
            {describeSeconds(m.intervalSec)} (grace {describeSeconds(m.graceSec)})
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Last ping</dt>
          <dd>{when(m.lastPingAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Next expected ping</dt>
          <dd>{when(m.nextExpectedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Last run took</dt>
          <dd>{m.lastDurationMs !== null ? `${(m.lastDurationMs / 1000).toFixed(1)} s (from …/start to the ping)` : "— (send …/start before the job to measure it)"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-600">Alerts</dt>
          <dd className="break-words">
            {[...m.emails.map((e) => `${e.address}${e.confirmed ? "" : " (waiting for confirmation)"}`), m.webhookUrl ? `webhook ${m.webhookUrl}${m.lastWebhook ? ` (last: ${m.lastWebhook.ok ? "delivered" : "failed"}, ${m.lastWebhook.detail}, ${m.lastWebhook.attempts} attempt${m.lastWebhook.attempts === 1 ? "" : "s"})` : ""}` : "", m.telegram ? "Telegram" : ""].filter(Boolean).join(" · ") || "No channel: add one to be alerted."}
          </dd>
        </div>
        {m.failMessage && (
          <div className="sm:col-span-2">
            <dt className="text-slate-600">Failure reported</dt>
            <dd className="font-mono text-xs text-red-900">{m.failMessage}</dd>
          </div>
        )}
      </dl>
      {!demo && onAction && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => onAction("view")}>
            Refresh
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => onAction(m.paused ? "resume" : "pause")}>
            {m.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => onAction("test")}>
            Send a test alert
          </button>
          {confirmDelete ? (
            <button type="button" className={`${btnSecondary} border-red-300 text-red-900`} disabled={busy} onClick={() => onAction("delete")}>
              Yes, delete everything
            </button>
          ) : (
            <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(true)}>
              Delete this monitor
            </button>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-700">Last pings ({m.pings.length})</h4>
          <ul className="mt-1 max-h-72 space-y-1 overflow-auto text-xs" tabIndex={0} aria-label="Last pings">
            {m.pings.length ? (
              m.pings.map((p, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 rounded-lg border border-slate-100 px-2 py-1">
                  <span className={`font-bold ${p.kind === "fail" ? "text-red-800" : p.kind === "start" ? "text-slate-700" : "text-emerald-800"}`}>{p.kind}</span>
                  <span>{when(p.at)}</span>
                  {p.durationMs !== null && <span className="text-slate-600">{(p.durationMs / 1000).toFixed(1)} s</span>}
                  {p.message && <span className="w-full break-words font-mono text-red-900">{p.message}</span>}
                </li>
              ))
            ) : (
              <li className="text-slate-600">No ping yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-700">Events ({m.events.length})</h4>
          <ul className="mt-1 max-h-72 space-y-1 overflow-auto text-xs" tabIndex={0} aria-label="Events">
            {m.events.length ? (
              m.events.map((e, i) => (
                <li key={i} className="rounded-lg border border-slate-100 px-2 py-1">
                  <span className={e.ok ? "text-slate-800" : "font-semibold text-red-900"}>{e.text}</span> <span className="text-slate-600">· {when(e.at)}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-600">No event yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CronJobMonitoringHeartbeatTool() {
  const uid = useId();
  const [name, setName] = useState("Nightly database backup");
  const [interval, setIntervalN] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<Unit>("d");
  const [grace, setGrace] = useState(30);
  const [graceUnit, setGraceUnit] = useState<Unit>("min");
  const [emails] = useState("");
  const [webhook, setWebhook] = useState("");
  const [telegram, setTelegram] = useState<null | "checking" | "available" | "unavailable">(null);
  const [chatId, setChatId] = useState("");
  const [monitor, setMonitor] = useState<MonitorView>(SAMPLE_MONITOR);
  const [demo, setDemo] = useState(true);
  const [links, setLinks] = useState<{ ping: string; manage: string } | null>(null);
  const [manage, setManage] = useState<string | null>(null);
  const [emailLink, setEmailLink] = useState<{ kind: "confirm" | "stop"; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  // A private dashboard link (?m=…) or an email link (?confirm=… / ?stop=…) opened the page.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const q = new URLSearchParams(window.location.search);
    const m = q.get("m");
    const confirm = q.get("confirm");
    const stop = q.get("stop");
    const run = async () => {
      if (confirm || stop) setEmailLink({ kind: confirm ? "confirm" : "stop", token: (confirm ?? stop)! });
      if (m) {
        setBusy(true);
        const r = await call<MonitorView>({ action: "view", manage: m });
        setBusy(false);
        if (r.ok) {
          setMonitor(r.data);
          setDemo(false);
          setManage(m);
        } else setFailure(r.error.message);
      }
    };
    void run();
  }, []);

  const create = async () => {
    setFailure(null);
    setNotice(null);
    const list = emails.split(/[,;\s]+/).filter(Boolean);
    if (list.length > MAX_EMAILS) return setFailure(`At most ${MAX_EMAILS} email addresses.`);
    setBusy(true);
    const r = await call<{ pingToken: string; manageToken: string; monitor: MonitorView }>({ action: "create", name, intervalSec: toSec(interval, intervalUnit), graceSec: toSec(grace, graceUnit), emails: list, webhookUrl: webhook.trim() || null, telegramChatId: telegram === "available" && chatId.trim() ? chatId.trim() : null });
    setBusy(false);
    if (!r.ok) return setFailure(r.error.message);
    const origin = window.location.origin;
    setLinks({ ping: `${origin}${PING_PATH}${r.data.pingToken}`, manage: `${origin}${TOOL_PATH}?m=${r.data.manageToken}` });
    setManage(r.data.manageToken);
    setMonitor(r.data.monitor);
    setDemo(false);
    if (list.length) setNotice(`A confirmation email was sent to ${list.join(" and ")}. No alert is sent to an address before it is confirmed.`);
  };

  const action = async (a: "view" | "pause" | "resume" | "test" | "delete") => {
    if (!manage) return;
    setBusy(true);
    setFailure(null);
    const r = await call<MonitorView & { deleted?: boolean }>({ action: a, manage });
    setBusy(false);
    if (!r.ok) return setFailure(r.error.message);
    if (a === "delete") {
      setMonitor(SAMPLE_MONITOR);
      setDemo(true);
      setLinks(null);
      setManage(null);
      setNotice("The monitor, its pings and its events were deleted.");
      return;
    }
    setMonitor(r.data);
    setNotice(a === "test" ? "Test alert sent to the channels (see the events)." : a === "pause" ? "Paused: no alerts until you resume." : a === "resume" ? "Resumed." : null);
  };

  const emailAction = async () => {
    if (!emailLink) return;
    setBusy(true);
    const r = await call<{ address: string; monitor: string }>({ action: emailLink.kind, token: emailLink.token });
    setBusy(false);
    if (!r.ok) return setFailure(r.error.message);
    setNotice(emailLink.kind === "confirm" ? `${r.data.address} will now receive alerts for "${r.data.monitor}".` : `${r.data.address} will not receive alerts for "${r.data.monitor}" any more.`);
    setEmailLink(null);
  };

  const checkTelegram = async () => {
    setTelegram("checking");
    const r = await call<{ telegram: boolean }>({ action: "config" });
    setTelegram(r.ok && r.data.telegram ? "available" : "unavailable");
  };

  const pingUrl = links?.ping ?? SAMPLE_PING_URL;

  return (
    <div className="space-y-6 text-navy">
      {emailLink && (
        <section className={`${card} border-blue-200`} aria-label="Email link">
          <p className="text-sm">{emailLink.kind === "confirm" ? "Confirm that this address may receive alerts for a cron monitor." : "Stop sending alerts to this address."}</p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={() => void emailAction()} disabled={busy}>
            {emailLink.kind === "confirm" ? "Confirm this address" : "Stop alerts to this address"}
          </button>
        </section>
      )}

      <section className={card} aria-labelledby={`${uid}-in`}>
        <h2 id={`${uid}-in`} className="text-lg font-semibold">
          New monitor
        </h2>
        <p className="mt-1 text-sm text-slate-700">Free, no account. You get a ping URL for your job and a private dashboard link. Unused monitors are removed.</p>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div>
            <label htmlFor={`${uid}-n`} className={label}>
              Job name
            </label>
            <input id={`${uid}-n`} className={`${inputCls} mt-1`} maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className={label}>Expected every (1 minute to 7 days)</legend>
              <div className="mt-1 flex gap-2">
                <label htmlFor={`${uid}-i`} className="sr-only">
                  Interval
                </label>
                <input id={`${uid}-i`} type="number" min={1} className={inputCls} value={interval} onChange={(e) => setIntervalN(Number(e.target.value))} />
                <label htmlFor={`${uid}-iu`} className="sr-only">
                  Interval unit
                </label>
                <select id={`${uid}-iu`} className={inputCls} value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as Unit)}>
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
            <fieldset>
              <legend className={label}>Grace period (1 minute to 1 day)</legend>
              <div className="mt-1 flex gap-2">
                <label htmlFor={`${uid}-g`} className="sr-only">
                  Grace period
                </label>
                <input id={`${uid}-g`} type="number" min={1} className={inputCls} value={grace} onChange={(e) => setGrace(Number(e.target.value))} />
                <label htmlFor={`${uid}-gu`} className="sr-only">
                  Grace period unit
                </label>
                <select id={`${uid}-gu`} className={inputCls} value={graceUnit} onChange={(e) => setGraceUnit(e.target.value as Unit)}>
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-w`} className={label}>
                Webhook URL <span className="font-normal text-slate-600">(optional, receives a JSON POST)</span>
              </label>
              <input id={`${uid}-w`} type="url" inputMode="url" className={`${inputCls} mt-1`} value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://hooks.example.com/alerts" />
            </div>
          </div>
          {telegram === null && (
            <div>
              <button type="button" className={`text-sm font-semibold text-primary underline-offset-2 hover:underline ${focusRing} rounded`} onClick={() => void checkTelegram()}>
                Add Telegram alerts
              </button>
            </div>
          )}
          {telegram === "checking" && <p className="text-sm text-slate-700">Checking whether Telegram alerts are available…</p>}
          {telegram === "unavailable" && <p className="text-sm text-slate-700">Telegram alerts are not available on this site yet; use a webhook.</p>}
          {telegram === "available" && (
            <div className="sm:w-1/2">
              <label htmlFor={`${uid}-tg`} className={label}>
                Telegram chat id
              </label>
              <input id={`${uid}-tg`} inputMode="numeric" className={`${inputCls} mt-1`} value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" />
            </div>
          )}
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? "Working…" : "Create monitor"}
          </button>
          <p className="text-xs text-slate-600">{STORED_NOTE}</p>
        </form>
      </section>

      {failure && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {failure}
        </div>
      )}

      {links && (
        <section className={`${card} border-emerald-200`} aria-label="Your links">
          <h2 className="text-lg font-semibold">Your two secret links</h2>
          <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Keep the dashboard link: there is no account and no way to recover it. Anyone with a link can use it, so do not share them.</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className={label}>Ping URL: call it when the job succeeds (GET, POST or HEAD)</p>
              <Copyable id={`${uid}-pu`} value={links.ping} name="Ping URL" />
            </div>
            <div>
              <p className={label}>Private dashboard link</p>
              <Copyable id={`${uid}-mu`} value={links.manage} name="dashboard link" />
            </div>
          </div>
        </section>
      )}

      <section className={`${card} min-h-64`} aria-labelledby={`${uid}-out`} aria-busy={busy}>
        <h2 id={`${uid}-out`} className="text-lg font-semibold">
          {demo ? "Example dashboard" : "Dashboard"}
        </h2>
        <div aria-live="polite" className="mt-2 text-sm text-slate-700">
          {notice && <p>{notice}</p>}
        </div>
        <div className="mt-3">
          <Dashboard m={monitor} demo={demo} local={now !== null} now={now} onAction={(a) => void action(a)} busy={busy} />
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700">Add it to your job</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre font-mono leading-5">{`# crontab: ping after a successful run (10 s timeout, 3 retries)
0 2 * * * /usr/local/bin/backup.sh && curl -fsS -m 10 --retry 3 ${pingUrl} > /dev/null

# report a failure with a message (up to 1 KB), or the start of a run
curl -fsS -m 10 --data-raw "backup failed: disk full" ${pingUrl}/fail
curl -fsS -m 10 ${pingUrl}/start`}</pre>
        </div>
      </section>
    </div>
  );
}
