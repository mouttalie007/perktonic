---
title: "Conditional Formatting Formula Generator: Excel & Sheets"
metaDescription: "Conditional formatting formula generator for Excel and Google Sheets: 27 ready rules with correct $ anchors, validation rules and click-by-click steps."
h1: "Conditional Formatting & Data Validation Rule Generator"
---
## Hero
Pick a rule, type your range, and this conditional formatting formula generator writes the exact formula with the right $ signs. You also get the click-by-click steps for both Excel and Google Sheets.

## How to use
1. Choose a rule from the library: duplicates, dates, rankings, blanks, text, whole rows, banding or data validation.
2. Type the range it applies to, such as A2:F100, plus the column, value or number the rule needs.
3. Copy the formula and follow the steps for your app. Excel and Google Sheets use different menus, and both are listed.
4. For anything the library does not cover, describe the rule in plain English under **Describe your own rule**. Give the range and pick the app.
5. Download the rule as a text file if you want to keep it.

## Examples
**Colour the whole row when a task is done.** Rule "Highlight the whole row by one cell's value", range A2:F100, column D, value Done. The formula is `=$D2="Done"`. The $ before D keeps every cell of the row looking at column D. Without it (`=D2="Done"`), column E would test E2 and the colour would land in the wrong places.

**Find repeated customer IDs.** Rule "Duplicates in one column", range B2:B100. The formula is `=COUNTIF($B$2:$B$100,B2)>1`. The list is fixed with $ signs and the tested cell moves down.

**Overdue and large.** Described in your own words: "highlight the row when Status in E is Overdue and Amount in D is over 1000", range A2:G200, Excel. The AI answers `=AND($E2="Overdue",$D2>1000)`, and our check confirms the formula is anchored on row 2 of the range.

## Tips and limits
- The library has 27 rules.
  - **Conditional formatting (19):** duplicates in one column and across several columns, duplicate rows, unique values, overdue dates, due in the next N days, today, weekends, top N, top N percent, bottom N, above and below average, blanks, non-blanks, text contains, whole row by value, banding, and cells that differ from the cell above.
  - **Data validation (8):** dropdowns from a range or a typed list, whole numbers between, dates between, text length, no duplicates, email-looking text and required cells.
- Library formulas are built in your browser; nothing is sent.
- Rules need a start row, so whole columns such as A:A are not accepted. Use A2:A1000.
- An AI rule is checked by our own code before you see it. We check that brackets and quotes balance and that every function exists. A warning appears when the formula does not point at the first row or column of the range, or when every row would test the same cell.
- Excel has no regular expressions before Microsoft 365. Pattern checks there use LEFT, MID and FIND and are approximate. Google Sheets can use REGEXMATCH.
- You can send 10 AI requests per 10 minutes. The library has no limit.

## FAQ
**How do I highlight duplicates?**
Use "Duplicates in one column" for a single list, or "Duplicate rows" when a row only counts as a duplicate if all its columns match. Both use COUNTIF or COUNTIFS with an absolute range.

**Why does my rule apply to the wrong row?**
A rule formula is written for the first cell of the range. If the range starts at row 2 but the formula says D1, every row tests the row above. In Excel, also select the range from its first cell.

**Can validation use another sheet?**
Yes. A dropdown can take its list from another sheet in both Excel and Google Sheets, for example `=Lists!$A$2:$A$20`. Google Sheets conditional formatting cannot point at another sheet directly; wrap the range in INDIRECT.

**What do the $ signs do?**
A $ before the column letter fixes the column, and a $ before the row number fixes the row. `$D2` keeps column D for every cell but moves down row by row.

**Does validation stop pasted values?**
No. In both apps, pasting over a cell can replace its validation, and values already in the cells are not checked. Pair validation with a highlight rule.

**Why do the steps say "starting from A2" for Excel?**
Excel reads the formula relative to the active cell of your selection. Selecting from the first cell of the range makes the formula line up.

## Privacy note
The rule library runs entirely in your browser and sends nothing. When you press Describe your own rule, the description, range and app are sent to our server and to the AI provider to write the rule. We do not store them with your identity, and identical requests may be answered from a short-lived cache. The example rule shown when the page opens is saved in the page and sends nothing.
