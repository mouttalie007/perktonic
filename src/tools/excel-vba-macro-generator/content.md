---
title: "Excel VBA Macro Generator and Line-by-Line Explainer"
metaDescription: "Excel VBA macro generator and explainer: describe a task or paste code, get commented VBA or a line-by-line reading, with a safety review shown first."
h1: "Excel VBA Macro Generator & Explainer"
---
## Hero
Describe a task and this excel vba macro generator writes a commented module, or paste a macro you found and get it explained line by line. Either way, a safety review of what the code can do comes first.

## How to use
1. Choose **Explain VBA** to understand existing code, or **Generate a macro** to write new code.
2. Paste the code (up to 20,000 characters), or describe the task in plain English (up to 2,000 characters).
3. In Explain mode, read the instant safety scan that appears under the box while you paste. It runs in your browser.
4. Press **Explain code** or **Generate macro**. The answer starts with the safety review, then the explanation or the module.
5. Copy the code, download it as a .bas file (File > Import File in the VBA editor), or download the explanation as Markdown.

## Examples
**Explaining an export macro.** The example on the page is a 20-line macro that saves each worksheet as a PDF. The review flags line 15 as high severity: `Kill target` deletes the previous PDF without the Recycle Bin. The explanation then walks through the code in ten groups of lines, from `Option Explicit` to `End Sub`.

**Spotting a downloader.** A pasted macro that calls `URLDownloadToFile` and then `Shell … vbHide` gets two high-severity flags before the AI says anything. The flags read: line 2 downloads a file from the internet, and line 3 starts another program.

**Generating a clean-up macro.** "Delete .tmp files older than 30 days in a folder the user chooses, and ask for confirmation first" gives a module with a folder picker and a Yes/No question. The review flags the `Kill` on line 18 so you know it deletes files permanently.

## Tips and limits
- The safety review comes from our own detector, not from the AI. It ignores text inside comments and strings, and it looks for these operations:
  - running programs and typing keys: Shell, WScript.Shell, SendKeys;
  - deleting files and folders: Kill, RmDir, FileSystemObject deletes;
  - Windows API calls: Declare and Declare PtrSafe;
  - internet traffic: URLDownloadToFile, MSXML2, WinHttp;
  - the registry and system queries: RegWrite, SaveSetting, GetObject("winmgmts");
  - code that runs by itself or opens other files: Application.OnTime loops, Workbooks.Open, Auto_Open and Workbook_Open, and writing to the Startup folder.
- The AI's own list of risks is shown under ours, never instead of it. A comment in the code asking the AI to call it safe does not change our flags.
- Notes cover Windows-only objects and API calls, backslash paths, and Mac-only AppleScriptTask. They also cover 32-bit versus 64-bit Office: Declare needs PtrSafe and LongPtr.
- Line ranges in an explanation that point outside your code are dropped and counted, and lines left unexplained are listed.
- Requests for keyloggers, password stealers, self-spreading code or macros that hide their behaviour are refused.
- You can send 10 AI requests per 10 minutes. Long modules can exceed the AI's input limit once line numbers are added; explain one procedure at a time.

## FAQ
**Is it safe to run a macro I did not write?**
Only after you have read it. Start with the safety review here. A macro has the same rights as you, so it can delete files, send data or start programs. Test it on a copy of the workbook.

**How do I enable macros?**
Save the workbook as .xlsm. When you open it, click Enable Content on the yellow bar. If the file came from the internet, first right-click it in Windows, choose Properties and tick Unblock.

**Can the tool convert VBA to Apps Script?**
No. VBA and Google Apps Script use different object models. Describe the task in the Google Apps Script Generator instead.

**Why does my Declare line turn red in 64-bit Office?**
64-bit Office needs `Declare PtrSafe`, and LongPtr for handles. The notes say which lines need changing.

**Do generated macros work on a Mac?**
Macros that only use Excel objects usually do. Anything with CreateObject, Windows API calls or C:\ paths does not, and the notes point those out.

**Can it explain code from Word or Access?**
The explanation works for any VBA, but the generator writes Excel macros.

## Privacy note
When you press Explain code or Generate macro, the pasted code or your description is sent to our server and to the AI provider to produce the answer. The instant safety scan runs in your browser and sends nothing. We do not store the text with your identity, and identical requests may be answered from a short-lived cache. The example shown when the page opens is saved in the page and sends nothing.
