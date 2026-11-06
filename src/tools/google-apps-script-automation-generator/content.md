---
title: "Google Apps Script Automation Generator for Sheets"
metaDescription: "Google Apps Script automation generator: describe a Sheets task, pick a trigger, and get commented code with install steps, permissions and a safety review."
h1: "Google Apps Script Automation Generator"
---
## Hero
Describe what your spreadsheet should do by itself. This google apps script automation generator writes the commented script and tells you how to install it. It lists the permissions it will ask for and flags anything worth checking before you run it.

## How to use
1. Describe the task in plain English, for example "when Status in column D becomes Done, email the address in column C".
2. Describe the sheet: its name, what each column holds, and the header row.
3. Pick when it should run: simple onEdit, installable on-edit, every hour, day or week, on form submit, or as an onOpen custom menu.
4. Press **Generate script**. Read the **Review before you run** box, then copy the code or download Code.gs.
5. Follow the installation steps: open Extensions > Apps Script, paste, save, create the trigger and authorise.

## Examples
**Email when a task is done.** Task: "When Status (D) changes to Done, email the owner in column C and write the date in column E". Sheet: "Tasks, header in row 1". Trigger: installable on-edit. The result is an `onStatusEdit(e)` function that ignores other sheets, the header row and multi-cell pastes. It sends one email with MailApp and stamps column E so nobody is emailed twice. Permissions: spreadsheets and script.send_mail. The quota note shows 100 recipients a day on a Gmail account and 1,500 on Workspace.

**Hourly exchange rate.** Task: "Every hour fetch https://api.example.com/rates and write the USD rate in B2". The script uses UrlFetchApp with error handling. It needs the external_request permission and counts against the URL Fetch quota of 20,000 calls a day on a Gmail account.

**A custom menu.** "Add a Tools menu that sorts the sheet by column A" gives an onOpen() function and a sort function. Clicking the menu item asks for permission the first time.

## Tips and limits
- The task and the sheet description can each be up to 2,000 characters. Name the sheets and columns exactly as they appear in your file.
- The permissions are detected by our own code from the services the script uses (SpreadsheetApp, GmailApp, MailApp, DriveApp, UrlFetchApp, CalendarApp, DocumentApp, ScriptApp and others), not taken from the AI. If the AI's list differs, both are shown.
- Every script is syntax-checked on our server before you see it. An error is shown with its line number.
- The safety review always runs. It lists e-mail addresses and websites that you did not mention, text run as code (eval, Function), sheet data sent to a URL, files shared publicly, and code that deletes data.
- Requests to copy data out without the owner knowing, to send spam or to get into other people's accounts are refused.
- You can send 10 AI requests per 10 minutes. The example on the page is saved and does not count.

## FAQ
**How do I install an Apps Script trigger?**
In the Apps Script editor, open Triggers (the clock icon), click Add Trigger, then pick the function, the event source and the event type. Simple triggers named onEdit or onOpen need no installation.

**Why does it ask for permissions?**
Google asks you to allow every service the script uses, such as sending mail as you or reading your spreadsheets. The list on the page shows which permission each service needs, so you know what you are agreeing to.

**Is it safe to run generated code?**
Read it first. The review box points out anything unexpected, and the script only does what the code says. Test it on a copy of your spreadsheet, and with your own email address before you email others.

**What is the difference between simple and installable triggers?**
Simple triggers run without permission, so they cannot send mail or call other websites, and they stop after 30 seconds. Installable triggers run as you, with the permissions you granted, and can run on a timer.

**Why did my onEdit not run when a formula changed?**
onEdit only fires for edits made by a person. Changes made by formulas, other scripts or imports do not trigger it. Use a time-driven trigger instead.

**Does it work in Google Workspace accounts?**
Yes. Workspace accounts usually have higher quotas, for example 1,500 email recipients a day instead of 100. Your administrator may block some services.

## Privacy note
When you press Generate script, your task description, sheet structure and trigger choice are sent to our server and to the AI provider to write the script. Nothing else leaves your browser, and the tool never sees your spreadsheet. We do not store the text with your identity, and identical requests may be answered from a short-lived cache. The example shown when the page opens is saved in the page and sends nothing.
