---
title: "Convert Excel Formula to Google Sheets (and LibreOffice)"
metaDescription: "Convert Excel formula to Google Sheets or LibreOffice: renamed functions, separators, sheet references and French, German or Spanish names, with warnings."
h1: "Convert Excel Formula to Google Sheets, LibreOffice and Back"
---

## Hero

Convert Excel formula to Google Sheets syntax, or to and from LibreOffice Calc. The tool handles renamed functions, comma or semicolon separators, sheet references, array formulas and French, German or Spanish function names. When a function has no equivalent, it says so and suggests a workaround.

## How to use

1. Paste a formula, with or without the leading `=`. Write `{=…}` for an older Ctrl+Shift+Enter array formula.
2. Choose where it comes from (Excel, Google Sheets or LibreOffice Calc) and its language or locale.
3. Choose the target and its language. The directions are Excel ↔ Google Sheets, Excel → LibreOffice and LibreOffice → Excel.
4. Read the translated formula, the compatibility warnings and the notes on behaviour.
5. Copy the formula, or download it together with the notes.

## Examples

**French Excel to Google Sheets** (loaded when the page opens):

```
=SI(NB.SI(Clients!$A$2:$A$500;A2)>0;RECHERCHEV(A2;Clients!$A$2:$D$500;4;FAUX);"Inconnu")
```

becomes

```
=IF(COUNTIF(Clients!$A$2:$A$500,A2)>0,VLOOKUP(A2,Clients!$A$2:$D$500,4,FALSE),"Inconnu")
```

The function names, the `;` separators and `FAUX` are translated; the text in quotes is not.

**Google Sheets to Excel.** `=IFERROR(JOIN(", ", UNIQUE(FILTER(B2:B, REGEXMATCH(C2:C, "^EU-")))), "none")` becomes `=IFERROR(TEXTJOIN(", ", FALSE, UNIQUE(FILTER(B2:B1048576, REGEXTEST(C2:C1048576, "^EU-")))), "none")`.

- JOIN becomes TEXTJOIN with ignore_empty set to FALSE.
- REGEXMATCH becomes REGEXTEST, which needs the 2024 release of Microsoft 365.
- The open-ended ranges get an end row, and a note explains why.

**Excel to LibreOffice.** `{=SUM(IF('Q3 Sales'!B2:B50>100,1,0))}` becomes `=SUM(IF($'Q3 Sales'.B2:B50>100;1;0))`, with a reminder to confirm it with Ctrl+Shift+Enter. In the other direction, LibreOffice's `=DAYSINMONTH(A2)` becomes `=DAY(EOMONTH(A2, 0))` in Excel.

## Tips and limits

- The dictionary covers 245 functions, with French, German and Spanish names for the common ones. It is a plain data file, so another language can be added without touching code.
- Functions with no equivalent stay in the formula, with a warning and a workaround. For example, Google Sheets has no AGGREGATE (use SUBTOTAL) and no TEXTBEFORE (use REGEXEXTRACT). Excel has no QUERY (use FILTER and SORT). LibreOffice has no LAMBDA.
- Version requirements are noted. XLOOKUP, FILTER and LET need LibreOffice 24.8 or newer; TEXTSPLIT and VSTACK need LibreOffice 25.8.
- Google Sheets always uses English function names. Its locale only changes the separators: `;` between arguments and `\` between array columns in comma-decimal locales.
- LibreOffice uses `Sheet.A1`; Excel and Google Sheets use `Sheet!A1`. Names with spaces are quoted in both.
- Error values and TRUE/FALSE are translated too: `#NV` and `WAHR` in German, `#VALEUR!` and `VRAI` in French.
- Array constant separators depend on the program's language settings, so the tool asks you to check them when they change.
- Functions missing from the dictionary are copied as they are, with a warning.
- Formulas can be up to 8,192 characters long.

## FAQ

**Why does a formula break when I paste it into Google Sheets?**
Usually it is one of three things. The function does not exist in Sheets (such as TEXTBEFORE or AGGREGATE). The file uses a different separator (`;` instead of `,`). Or the formula was written with localized names, such as SOMME instead of SUM.

**Which Excel functions do not exist in Sheets?**
Among others: AGGREGATE, TEXTBEFORE, TEXTAFTER, TAKE, DROP, EXPAND, WEBSERVICE, FILTERXML, STOCKHISTORY, INFO and the CUBE functions. The tool gives a workaround for each one.

**What about LibreOffice?**
Calc uses `;` between arguments and `Sheet.A1` for references. Since version 24.8 it has XLOOKUP, FILTER, SORT, UNIQUE and LET, and since 25.8 TEXTSPLIT, VSTACK and TAKE. It has no LAMBDA, MAP or BYROW.

**Does it convert Google Sheets array formulas?**
Yes. `ARRAYFORMULA(…)` is removed for Excel 365, which spills results by itself. `{=…}` from older Excel becomes `ARRAYFORMULA(…)` in Sheets.

**Is my formula sent anywhere?**
No. The translation runs entirely in your browser.

## Privacy note

Formulas are translated by code running in your browser. Nothing you type is uploaded, logged or stored. The page makes no network requests with your data, and closing it clears everything.
