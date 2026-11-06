// The model answer behind the saved sample (also the golden answer of eval case "email-when-done").
export const sampleAnswer = {
  "status": "ok" as const,
  "summary": "Emails the task owner when a row's Status becomes Done and records the date in column E, so each task is emailed once.",
  "script": "/**\n * Emails the task owner when Status (column D) on the \"Tasks\" sheet is set to \"Done\",\n * then writes the date in column E so nobody is emailed twice.\n * Runs from an installable \"On edit\" trigger on onStatusEdit (see the installation steps).\n */\nconst SHEET_NAME = 'Tasks';\nconst TASK_COL = 2; // B: task name\nconst EMAIL_COL = 3; // C: owner email\nconst STATUS_COL = 4; // D: status\nconst NOTIFIED_COL = 5; // E: date the email was sent\n\nfunction onStatusEdit(e) {\n  // Ignore other sheets, the header row, multi-cell pastes and other columns.\n  if (!e || !e.range) return;\n  const sheet = e.range.getSheet();\n  if (sheet.getName() !== SHEET_NAME) return;\n  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;\n  const row = e.range.getRow();\n  if (row === 1 || e.range.getColumn() !== STATUS_COL) return;\n  if (String(e.value).trim() !== 'Done') return;\n\n  const values = sheet.getRange(row, 1, 1, NOTIFIED_COL).getValues()[0];\n  const email = String(values[EMAIL_COL - 1]).trim();\n  const task = values[TASK_COL - 1];\n  // No address, or already notified: do nothing.\n  if (!email || values[NOTIFIED_COL - 1]) return;\n\n  MailApp.sendEmail({\n    to: email,\n    subject: 'Task done: ' + task,\n    body: 'The task \"' + task + '\" (row ' + row + ') was marked as Done.',\n  });\n  sheet.getRange(row, NOTIFIED_COL).setValue(new Date());\n}\n",
  "installSteps": [
    "Open the spreadsheet and choose Extensions > Apps Script.",
    "Replace the code in Code.gs with this script and click Save.",
    "Click Triggers (the clock icon) > Add Trigger, choose onStatusEdit, then From spreadsheet > On edit, and save.",
    "Allow the permissions Google asks for (choose your account, then Allow).",
    "Test it once on a copy or a test row."
  ],
  "scopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.send_mail"
  ],
  "assumptions": [
    "The sheet is named Tasks and row 1 holds the headers.",
    "Status is set to exactly Done (typed or picked from a list)."
  ]
};
