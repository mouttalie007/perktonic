---
title: "Excel Formula Debugger Online: Fix #VALUE!, #N/A, #REF!"
metaDescription: "Excel formula debugger online: paste a formula, pick the error and see ranked causes with exact fixes, then ask the AI when your data needs a closer look."
h1: "Excel Formula Debugger Online"
---
## Hero
Paste the formula, pick the error your spreadsheet shows, and this excel formula debugger online ranks the likely causes at once. Where the fix is mechanical, it shows the corrected formula.

## How to use
1. Paste the formula that shows the error (Excel, Google Sheets or LibreOffice Calc, English function names).
2. Pick the error: #VALUE!, #REF!, #N/A, #NAME?, #DIV/0!, #NUM!, #NULL!, #SPILL!, ### or circular reference.
3. Read **Likely causes**. They appear instantly, ranked as high, medium or low confidence. Each one explains the cause in plain words and how to fix it. When the fix is mechanical, it shows a corrected formula with the changes highlighted.
4. For a circular reference, type the cell that holds the formula (for example D20) so the tool can check whether it includes itself.
5. If the rules are not enough, describe your data and press **Ask the AI** for a diagnosis that takes your data into account.
6. Copy the fixed formula or download the full report.

## Examples
**#REF! from VLOOKUP.** `=VLOOKUP(A2,Products!A2:C200,4)` gives "VLOOKUP asks for column 4 of a 3-column table". The AI, told that prices are in column D, suggests `=VLOOKUP(A2,Products!A2:D200,4,FALSE)`. It lists its assumptions: prices are in column D, and codes are unique.

**#NAME? from curly quotes.** `=IF(A1=“Yes”,1,0)`, pasted from an email, is diagnosed with high confidence. The mechanical fix is `=IF(A1="Yes",1,0)`.

**Circular reference.** `=SUM(D2:D20)` in D20 is reported as "The formula refers to its own cell". The AI suggests `=SUM(D2:D19)`.

## Tips and limits
- The rule engine has 33 rules. They cover smart quotes, unbalanced brackets and quotes, and semicolon or comma separators. They catch unknown or misspelled functions, functions too new for your version, a missing colon in a range and text without quotes. They find a literal #REF! in the formula, column numbers past the table, approximate-match lookups, and numbers stored as text. They spot extra spaces, INDEX/MATCH ranges that do not line up, mismatched SUMIFS sizes, division by empty cells, a space between ranges, IRR that does not converge, blocked spill ranges, narrow columns, negative times and self-references.
- The rules only see the formula, not your file. Causes that depend on cell contents, such as text numbers or trailing spaces, are marked medium or low confidence.
- Formulas can be up to 8,000 characters and the data description up to 2,000.
- An AI correction is checked on our server: function names against a list of about 500 per app, plus brackets, quotes and separators. A failed check shows a warning. A fix always comes with the assumptions it depends on.
- You can send 10 AI requests per 10 minutes. The rule-based causes keep working when the AI is unavailable.

## FAQ
**Why do I get #VALUE! when the cells look fine?**
A cell can look like a number and still be text, for example a value pasted from a web page with a non-breaking space, or a number with a thousands separator typed as text. Arithmetic on text gives #VALUE!. Check the cell with ISTEXT().

**What is the difference between #N/A and #REF!?**
#N/A means a lookup did not find the value: the formula works, but the data has no match. #REF! means the formula points at cells that do not exist, such as a deleted column or a column number past the table.

**Should I just wrap everything in IFERROR?**
No. IFERROR hides every error, including real mistakes, so wrong totals go unnoticed. Fix the cause first. Then, if some errors are expected, wrap only that part, and prefer IFNA for lookups. This tool never offers a wrapper as the fix.

**Does it change my spreadsheet?**
No. It only reads the formula you paste. You copy the fix yourself.

**Why does a fix say "assumes"?**
Every correction depends on something the tool cannot see, such as which column holds the price. The assumptions tell you what to check before you trust the fix.

**Does it work for Google Sheets and LibreOffice?**
Yes. Pick the app, so that function names and version limits are checked against the right list.

## Privacy note
The rule-based causes are computed in your browser and send nothing. When you press Ask the AI, the formula, the error, the cell and your description are sent to our server and to the AI provider to produce the answer. We do not store them with your identity, and identical requests may be answered from a short-lived cache. The example answer shown when the page opens is saved in the page and sends nothing.
