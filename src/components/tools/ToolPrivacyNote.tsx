import type { ToolDef } from "@/config/tools";

/** What happens to the visitor's data, in one visible line right under the tool (kept in step with the privacy policy). */
function note(tool: ToolDef): string {
  if (tool.slug === "webhook-test-url-generator")
    return "The test URL and the requests it receives are kept in memory on our server for 60 minutes and then deleted. Do not send passwords or personal data to it.";
  if (tool.slug === "cron-job-monitoring-heartbeat")
    return "A monitor stores only its name, settings and ping times, under secret links, until you delete it or it has been idle for 90 days. There is no account.";
  if (tool.ai)
    return "Your text is sent to our server and to the AI provider only when you press the button. We do not store it with your identity, and nothing is sent before that.";
  if (tool.serverSide)
    return "Only the address you enter is sent to our server, which fetches it for you. The result is not stored.";
  return "Files and text are processed locally in your browser. Nothing you load here is uploaded to our servers.";
}

export function ToolPrivacyNote({ tool }: { tool: ToolDef }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-[0.82rem] leading-relaxed text-slate-600 sm:px-2">
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-emerald-600">
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span>
        <strong className="font-semibold text-slate-700">Your data:</strong> {note(tool)}
      </span>
    </p>
  );
}
