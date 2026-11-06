---
title: "Clean Messy CSV Data Online: Encoding, Dates, Duplicates"
metaDescription: "Clean messy csv data online in your browser: fix garbled Arabic or accented text, trim spaces, standardise dates, drop duplicates and see every change."
h1: "Clean Messy CSV Data Online"
---

## Hero

Clean messy csv data online in one pass: fix encoding problems, trim stray spaces, standardise dates and blanks, tidy header names and remove duplicates. A report lists every change.

## How to use

1. Paste CSV text or choose a .csv, .tsv, .txt or .xlsx file. The encoding is detected automatically; you can override it.
2. Switch individual cleaning steps on or off. They run in a fixed order, from repairing characters to removing duplicates.
3. If a date column could be read as day-first or month-first, the tool stops and asks you which one before changing it.
4. Read the report: changes per step, a highlighted preview, and a before/after log with row and column numbers.
5. Download the clean CSV and, if you need an audit trail, the change log.

## Examples

**A typical CRM export.** This input:

```
 Full Name ,Signup,Plan
  Ana Souza ,25/03/2026,Pro
Liam O’Brien,02/03/2026,N/A
Ana Souza,25/03/2026,Pro
```

becomes:

```
full_name,signup,plan
Ana Souza,2026-03-25,Pro
Liam O'Brien,2026-03-02,
```

The report says: trim whitespace 2, straighten smart quotes 1, standardise blank values 1, standardise dates 3, normalise header names 3, remove duplicate rows 1, cells changed 9. The Signup column was read as DD/MM because `25/03/2026` can only mean 25 March, and the report shows that reason.

**An ambiguous date column.** For `03/04/2026` and `05/06/2026`, nothing shows whether the day or the month comes first. The tool leaves the column unchanged and asks. If you answer "Day first", the values become `2026-04-03` and `2026-06-05`.

**An Arabic file from an older Excel.** A Windows-1256 file with `محمد علي,القاهرة` would show as garbled characters in many tools. The tool detects Windows-1256 and shows the reason: the file is not valid UTF-8, and its non-ASCII bytes form whole words. Download with the BOM option on and Excel opens the Arabic text correctly.

## Tips and limits

- Encodings: UTF-8 (with or without BOM), UTF-16 with BOM, Windows-1256 (Arabic) and ISO-8859-1 / Windows-1252 are detected. Choose one manually if the guess is wrong; the change is applied immediately.
- "Repair garbled characters" fixes text that was already decoded with the wrong encoding before it reached you, such as `CafÃ©` → `Café`. It only changes a cell when the repair produces valid text.
- Invisible characters removed: zero-width space, word joiner, BOM, soft hyphen and control characters. Zero-width joiner and non-joiner are kept, because Persian, Arabic and emoji text need them.
- Dates recognised: `2026-04-03`, `03/04/2026`, `3.4.26`, `3 Apr 2026`, `April 3, 2026`, with optional times. Invalid dates such as `31/02/2026` stay as they are and are counted separately. Two-digit years 00–69 are read as 2000–2069.
- The blank-value list (`N/A`, `null`, `-` and others) is editable. Remove `NA` if your data has Namibia's country code.
- Duplicates are compared after cleaning, so `" Ana "` and `"Ana"` count as the same row. The first copy is kept.
- Limits: pasted text up to 5 MB, files up to 50 MB. The work runs in a background worker with a progress bar and a Cancel button. The log on screen lists the first 300 changes; the downloaded log holds up to 20,000, and the counts always cover every change.
- Formulas in .xlsx files are not recalculated; the saved values are used. Old .xls files must be saved as .xlsx or CSV first.

## FAQ

**How do I fix garbled characters in a CSV?**
Open the file here and check the detected encoding. If text like `Ø§Ù„` still appears, keep "Repair garbled characters" on, or pick the right encoding (for example Windows-1256 for Arabic) from the list.

**How do I remove duplicate rows?**
Keep "Remove duplicate rows" on. Rows that are identical after the other steps are removed, and the log says which earlier row each one duplicated. Tick "Ignore case and spacing" to also match `ana` with `Ana`.

**Does the tool keep my original file?**
Yes. Your file is only read, never changed. The cleaned data is a new download named `yourfile-clean.csv`.

**Why didn't my dates change?**
Either the column is ambiguous and is waiting for your answer, or fewer than 80% of its cells look like dates, so it is not treated as a date column.

**Can I undo one kind of change?**
Switch that step off. The result is recalculated, and only that step's changes disappear.

**Will Excel show the result correctly?**
Leave "Save as UTF-8 with BOM" ticked. Without the BOM, some Excel versions show Arabic or accented letters as symbols.

## Privacy note

Cleaning happens in your browser. Your file is never uploaded, and nothing you paste or open is stored, logged or sent to anyone.
