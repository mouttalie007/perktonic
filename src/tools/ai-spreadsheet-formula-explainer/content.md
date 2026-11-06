---
title: "AI Spreadsheet Formula Explainer: Nested Formulas"
metaDescription: "AI spreadsheet formula explainer: paste an Excel or Google Sheets formula, see its nesting tree at once, then get a plain-English reading on request."
h1: "AI Spreadsheet Formula Explainer"
---
## Hero
Paste a formula you did not write. This ai spreadsheet formula explainer instantly shows its structure, function by function. On request, it also tells you in plain English what each part does.

## How to use
1. Paste a formula from Excel, Google Sheets or LibreOffice Calc, starting with = and using English function names.
2. Read the **Structure** tree. It appears as you type and works offline. Each function shows its purpose, the name of every argument and what it returns.
3. Expand or collapse branches to follow a deeply nested formula one level at a time.
4. Optionally describe your data ("Sales is a table with Date, Region and Amount").
5. Press **Explain in plain English** for a summary of at most 80 words and an ordered list of steps.
6. Copy the outline or the explanation, or download both as a Markdown file.

## Examples
**A lookup with a fallback.** `=IFERROR(VLOOKUP(A2,Prices!A:C,3,FALSE),"Not found")`. The tree shows IFERROR with two arguments: *value* is the VLOOKUP, and *value_if_error* is the text "Not found". Inside VLOOKUP, *table_array* is described as "All of columns A to C on sheet Prices", and *range_lookup* FALSE means an exact match. The narration says it searches column A of Prices for A2 and returns column C, or Not found.

**A modern formula.** The example on the page uses LET, FILTER, MONTH, IF, SUM, ROUND and AVERAGE on an Excel table. The tree labels `sales` as "a name given a value by LET in this formula" and `Sales[Amount]` as "Column Amount of table Sales". The narration explains that multiplying two TRUE/FALSE lists works as AND.

**A broken formula.** `=IFERROR(VLOOKUP(A2,Prices!A:C,3,FALSE,"Not found")` shows "The bracket opened at position 9 is never closed", with a caret under that bracket.

## Tips and limits
- Formulas can be up to 8,000 characters long. The tree handles 20 and more levels of nesting, array constants such as {1,2;3,4}, sheet names in quotes such as 'My Sheet'!A1:B2, table references such as Table1[Col] and [@Price], LET, LAMBDA, and text that contains brackets, commas or doubled quotes.
- Descriptions come from our own dictionary of 177 common functions. A function outside it is still shown in the tree, marked as not described.
- **The tool does not calculate values.** It says what each part returns, such as "a position number" or "the list of rows where the region is North". It never shows totals, because an AI can get arithmetic wrong.
- The narration quotes pieces of your formula. Our server deletes any step whose quoted piece is not in your formula, and says how many were removed.
- Function names must be in English. Semicolon separators (European locales) are understood.
- You can send 10 AI requests per 10 minutes. If the AI is busy or the daily limit is reached, the structure tree keeps working.

## FAQ
**Can it explain array formulas?**
Yes. Array constants, dynamic arrays such as FILTER and UNIQUE, spill references like A2#, and old Ctrl+Shift+Enter formulas are all parsed. The narration explains that a condition on a range gives one TRUE/FALSE per row.

**What does each nested function return?**
Every function in the tree has a "Returns" line from the dictionary, such as "a position number, or #N/A" for MATCH. The narration describes the result of each step in words, without calculating it.

**Does it change my formula?**
No. The tool only reads it. Nothing is rewritten, and the steps quote your formula exactly.

**Is my formula sent anywhere?**
Not for the structure tree, which runs in your browser. The formula and your notes are sent only when you press Explain in plain English.

**Why does it say my formula does not parse?**
A bracket, a quote or a separator is usually missing or extra. The message gives the position, and the caret points at it. The 1.3 Formula Error Debugger can suggest a fix.

**Does it work with LibreOffice syntax?**
It reads Excel-style references (A1, Sheet1!A1). LibreOffice's native $Sheet1.A1 style is not supported in v1.

## Privacy note
The structure tree is built in your browser and sends nothing. When you press Explain in plain English, the formula and the optional notes are sent to our server and to the AI provider to write the explanation. We do not store them with your identity, and identical requests may be answered from a short-lived cache. The example narration shown when the page opens is saved in the page and sends nothing.
