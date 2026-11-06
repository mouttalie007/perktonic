// Our own safety detector: regular expressions and a keyword list over the code (never the model).
// It reads the code view of each line (comments and string contents blanked), so a keyword inside a
// comment or a string never raises a flag; string arguments are read back only where the code calls
// CreateObject / GetObject or writes a file.

import { literalAt, literalsOf, vbaLines, type VbaLine } from "./vbaText";

export type Severity = "high" | "medium" | "low";

export interface SafetyFlag {
  id: string;
  line: number;
  severity: Severity;
  title: string;
  what: string;
  excerpt: string;
}

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  what: string;
  /** Tested on the code view of one line. */
  re: RegExp;
  /** Optional check on the string literal passed as first argument (CreateObject("...")). */
  arg?: RegExp;
}

const RULES: Rule[] = [
  { id: "shell", severity: "high", title: "Shell", what: "Starts another program or a command line with the macro's rights (it can run anything on the computer).", re: /(^|[^\w.])Shell\s*[(\s]/i },
  { id: "wscript-shell", severity: "high", title: 'CreateObject("WScript.Shell")', what: "Gets the Windows scripting shell: it can run commands, read and write the registry and start programs.", re: /\bCreateObject\s*\(\s*"/i, arg: /^WScript\.Shell$/i },
  { id: "kill", severity: "high", title: "Kill", what: "Deletes files from disk. Deleted files do not go to the Recycle Bin.", re: /(^|[\s:])Kill\s+\S/i },
  { id: "rmdir", severity: "high", title: "RmDir", what: "Deletes a folder.", re: /(^|[\s:])RmDir\s+\S/i },
  { id: "fso-delete", severity: "high", title: "FileSystemObject delete", what: "Deletes files or folders through Scripting.FileSystemObject, without the Recycle Bin.", re: /\.(DeleteFile|DeleteFolder)\b/i },
  { id: "declare", severity: "medium", title: "Declare (Windows API)", what: "Calls functions inside a Windows DLL directly. A wrong declaration can crash Excel; API calls can do anything the DLL allows.", re: /(^|\s)Declare\s+(PtrSafe\s+)?(Function|Sub)\b/i },
  { id: "url-download", severity: "high", title: "URLDownloadToFile", what: "Downloads a file from the internet to disk.", re: /\bURLDownloadToFile\b/i },
  { id: "xmlhttp", severity: "high", title: "External connection (MSXML2 / WinHttp)", what: "Sends or receives data over the internet. Check where it connects and what it sends.", re: /\bCreateObject\s*\(\s*"/i, arg: /^(MSXML2\.(Server)?XMLHTTP(\.\d\.\d)?|WinHttp\.WinHttpRequest(\.\d\.\d)?|Microsoft\.XMLHTTP)$/i },
  { id: "xmlhttp-new", severity: "high", title: "External connection (MSXML2 / WinHttp)", what: "Sends or receives data over the internet. Check where it connects and what it sends.", re: /\bNew\s+(MSXML2\.(Server)?XMLHTTP\d*|WinHttp\.WinHttpRequest|WinHttpRequest|XMLHTTP\d*)\b/i },
  { id: "registry", severity: "high", title: "Registry access", what: "Reads or changes the Windows registry, which holds system and program settings.", re: /\.(RegWrite|RegDelete|RegRead)\b/i },
  { id: "savesetting", severity: "low", title: "SaveSetting / DeleteSetting", what: "Writes or deletes VBA's own settings in the registry (HKEY_CURRENT_USER\\Software\\VB and VBA Program Settings).", re: /(^|[\s:])(SaveSetting|DeleteSetting)\b/i },
  { id: "wmi", severity: "high", title: 'GetObject("winmgmts")', what: "Uses Windows Management Instrumentation: it can list and stop processes or query the system.", re: /\bGetObject\s*\(\s*"/i, arg: /^winmgmts/i },
  { id: "ontime", severity: "medium", title: "Application.OnTime", what: "Schedules a macro to run later; a macro that schedules itself keeps running in a loop until Excel closes.", re: /\bApplication\.OnTime\b/i },
  { id: "workbooks-open", severity: "low", title: "Workbooks.Open", what: "Opens another file, which may run that file's own macros.", re: /\bWorkbooks\.Open\b/i },
  { id: "sendkeys", severity: "medium", title: "SendKeys", what: "Types keystrokes into whatever window has focus, which can trigger actions in other programs.", re: /(^|[\s:.])SendKeys\b/i },
  { id: "autorun", severity: "medium", title: "Runs automatically", what: "This procedure runs by itself when the workbook opens or closes, without anyone starting it.", re: /^\s*(Private\s+|Public\s+)?Sub\s+(Auto_Open|Auto_Close|Workbook_Open|Workbook_BeforeClose|Workbook_Activate)\b/i },
  { id: "startup", severity: "high", title: "Writes to the Startup folder", what: "Files in Excel's startup folder (XLSTART) open every time Excel starts, so the code would run on every launch.", re: /\bStartupPath\b|\bAltStartupPath\b/i },
];

const STARTUP_LITERAL = /\\XLSTART\b|\\Startup\\/i;

function argAfter(line: VbaLine, match: RegExpExecArray): string | null {
  const q = line.code.indexOf('"', match.index);
  return q >= 0 ? literalAt(line.raw, q) : null;
}

export function detect(code: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  for (const line of vbaLines(code)) {
    if (!line.code.trim()) continue;
    for (const r of RULES) {
      const m = new RegExp(r.re.source, r.re.flags).exec(line.code);
      if (!m) continue;
      if (r.arg) {
        const arg = argAfter(line, m);
        if (arg === null || !r.arg.test(arg.trim())) continue;
      }
      if (r.id === "xmlhttp-new" && flags.some((f) => f.line === line.n && f.id === "xmlhttp")) continue;
      flags.push({ id: r.id === "xmlhttp-new" ? "xmlhttp" : r.id, line: line.n, severity: r.severity, title: r.title, what: r.what, excerpt: line.raw.trim().slice(0, 160) });
    }
    if (literalsOf(line).some((s) => STARTUP_LITERAL.test(s)) && !flags.some((f) => f.line === line.n && f.id === "startup"))
      flags.push({ id: "startup", line: line.n, severity: "high", title: "Writes to the Startup folder", what: "The code names Excel's startup folder (XLSTART); files placed there open every time Excel starts.", excerpt: line.raw.trim().slice(0, 160) });
  }
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity] || a.line - b.line);
}

export const DETECTED_IDS = RULES.map((r) => r.id);

/** Windows vs Mac and 32 vs 64-bit notes, from the same code view. */
export function platformNotes(code: string): string[] {
  const lines = vbaLines(code);
  const view = lines.map((l) => l.code).join("\n");
  const literals = lines.flatMap(literalsOf).join("\n");
  const notes: string[] = [];
  const declares = lines.filter((l) => /(^|\s)Declare\s+(Function|Sub)\b/i.test(l.code));
  if (declares.length) notes.push(`Line ${declares.map((l) => l.n).join(", ")}: Declare without PtrSafe does not compile in 64-bit Office. Write Declare PtrSafe, use LongPtr for handles and pointers, and wrap old declarations in #If VBA7 Then … #Else … #End If for Office 2007 and older.`);
  if (/(^|\s)Declare\s+PtrSafe\b/i.test(view)) notes.push("Declare PtrSafe needs VBA7 (Office 2010 or newer). Handles and pointers must be LongPtr, otherwise 64-bit Excel can crash.");
  if (/(^|\s)Declare\s/i.test(view) && /\bLib\s+"/i.test(view)) notes.push("Windows API declarations (Lib \"user32\", \"kernel32\"…) do not exist on a Mac; the macro stops with an error there.");
  if (/\bCreateObject\s*\(/i.test(view) && /^(WScript\.|Scripting\.|MSXML2\.|WinHttp\.|Shell\.Application|Outlook\.Application)/im.test(literals)) notes.push("CreateObject with Windows components (WScript, Scripting.FileSystemObject, MSXML2, WinHttp, Outlook) works only on Windows; Excel for Mac has no ActiveX/COM objects.");
  if (/[A-Za-z]:\\|\\\\/.test(literals) || /"\\"/.test(lines.map((l) => l.raw).join("\n"))) notes.push("Paths with backslashes (C:\\…) are Windows-only. Application.PathSeparator gives \\ on Windows and / on a Mac.");
  if (/\b(MacScript|AppleScriptTask)\b/i.test(view)) notes.push("MacScript / AppleScriptTask only work in Excel for Mac.");
  if (/(^|[\s:.])SendKeys\b/i.test(view)) notes.push("SendKeys is unreliable on a Mac and with some Windows security settings.");
  if (/#If\s+Mac\b/i.test(view)) notes.push("The code already separates Mac and Windows with #If Mac Then.");
  return notes;
}
