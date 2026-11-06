---
title: "XLOOKUP vs INDEX MATCH Generator: Convert Lookups"
metaDescription: "An xlookup vs index match generator that rewrites VLOOKUP, HLOOKUP, INDEX/MATCH and XLOOKUP formulas into each other and explains what changes."
h1: "XLOOKUP vs INDEX-MATCH Generator"
---

## Hero

This xlookup vs index match generator converts a lookup formula into XLOOKUP, INDEX-MATCH and VLOOKUP or HLOOKUP. It shows what each version can and cannot do: left lookups, column inserts, approximate matches and Excel versions.

## How to use

1. Paste a formula that contains VLOOKUP, HLOOKUP, INDEX with MATCH, or XLOOKUP. IFERROR or IFNA around it and other functions around it are fine.
2. Choose the style you want. All three conversions are shown, with yours first.
3. Read the notes under each formula, such as "needs sorted data" or "not available in Excel 2019".
4. Copy the formula, or download the comparison table as CSV.

## Examples

**VLOOKUP with IFERROR to XLOOKUP.** The input

```
=IFERROR(VLOOKUP(A2, Products!$A$2:$D$500, 3, FALSE), "Not found")
```

becomes

```
=XLOOKUP(A2, Products!$A$2:$A$500, Products!$C$2:$C$500, "Not found")
=IFERROR(INDEX(Products!$C$2:$C$500, MATCH(A2, Products!$A$2:$A$500, 0)), "Not found")
```

The tool notes that XLOOKUP's if_not_found only replaces "not found". IFERROR also hides real mistakes such as #REF!.

**A left lookup.** `=XLOOKUP(F2, $C$2:$C$200, $A$2:$A$200)` returns column A while searching column C. The INDEX-MATCH version is `=INDEX($A$2:$A$200, MATCH(F2, $C$2:$C$200, 0))`. VLOOKUP is marked "Not possible", because it can only return columns to the right of the column it searches.

**An approximate tax band.** `=VLOOKUP(B5, $H$2:$I$8, 2)` has no fourth argument, so it is an approximate match. The conversions keep that meaning: `=XLOOKUP(B5, $H$2:$H$8, $I$2:$I$8, , -1)` and `=INDEX($I$2:$I$8, MATCH(B5, $H$2:$H$8, 1))`. A note says MATCH needs the bands sorted smallest first; XLOOKUP does not.

## Tips and limits

- VLOOKUP's column number is turned into the matching column of the table, so `$A$2:$D$500` with 3 becomes `$C$2:$C$500`. Dollar signs and sheet names are kept.
- A column number that comes from a formula (for example `MATCH(B$1, Data!$1:$1, 0)`) becomes `INDEX(table, 0, …)` in XLOOKUP.
- Named ranges and table references work for XLOOKUP and INDEX-MATCH. Rebuilding a VLOOKUP needs plain cell ranges, because the tool has to know which column is which.
- HLOOKUP works the same way across rows. Several result columns (`{3,4}` or a wider return range) spill in Excel 365 and Google Sheets.
- Formulas with `;` between arguments, as in many European versions of Excel, keep the `;`.
- Two-way lookups (INDEX with two MATCH functions) and INDEX with an area number are not converted. Formulas longer than 8,192 characters, Excel's own limit, are rejected.
- The original style is shown unchanged, so you can compare like with like.
- Conversions update as you type. A formula that cannot be read gets a specific reason, such as a missing closing parenthesis, an unclosed quote or a column number larger than the table (which Excel would answer with #REF!).

## FAQ

**Is XLOOKUP better than VLOOKUP?**
For most new sheets, yes. It matches exactly by default, can look left, survives inserted columns and has a built-in "not found" value. VLOOKUP is still the safer choice when the file must open in Excel 2019 or older.

**Does XLOOKUP work in Google Sheets?**
Yes. Google Sheets has supported XLOOKUP since 2022, with the same arguments as Excel. LibreOffice added it in version 24.8.

**Why use INDEX-MATCH?**
It works in every Excel version, looks in any direction and does not break when columns are inserted. One MATCH in a helper column can also feed several INDEX formulas.

**Why does my VLOOKUP return the wrong row?**
Usually the fourth argument is missing, which means approximate match on data that is not sorted. Add FALSE for an exact match.

**What is the difference between IFERROR and IFNA?**
IFNA only catches #N/A, the "not found" error. IFERROR catches every error, including typos that produce #REF! or #VALUE!, so it can hide mistakes.

**Can XLOOKUP return several columns?**
Yes. Give it a return range several columns wide and the result spills into the cells to the right.

## Privacy note

The formula you paste is read and converted on this page, in your browser. It is not uploaded, logged or stored, and the page sends no requests containing it.
