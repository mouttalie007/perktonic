---
title: "Excel to Markdown Table Generator: Markdown, HTML, LaTeX"
metaDescription: "Paste cells from Excel or Google Sheets and this excel to markdown table generator returns clean Markdown, HTML or LaTeX table code, right in your browser."
h1: "Excel to Markdown Table Generator"
---

## Hero

This excel to markdown table generator turns cells copied from Excel, Google Sheets or a CSV file into Markdown, HTML or LaTeX table code, with alignment and escaping handled for you.

## How to use

1. Copy a range in Excel or Google Sheets and paste it into the box, or choose an .xlsx, .csv or .tsv file.
2. Pick the output format: Markdown, HTML or LaTeX.
3. Leave "First row is the header" on if your first row holds column names, and type a range such as B2:E20 if you only want part of the sheet.
4. Set the alignment. Auto puts text on the left and numbers on the right; you can override any single column.
5. Check the Preview tab, then copy the code or download it as a .md, .html or .tex file.

## Examples

**Markdown for a GitHub README.** Three cells pasted from a sheet, one containing a pipe:

```
Item                  Qty   Price
Apple | Granny Smith  3     $0.50
Pear                  12    $1.25
```

The tool returns:

```
| Item                  | Qty | Price |
| :-------------------- | --: | ----: |
| Apple \| Granny Smith |   3 | $0.50 |
| Pear                  |  12 | $1.25 |
```

The pipe is escaped as `\|` so the row does not split, and Qty and Price are right-aligned because every value in them is a number.

**LaTeX for a paper.** Cells containing `R&D share`, `12.5%`, `Cost_center` and `#4` become:

```
\textbf{Metric} & \textbf{Value} \\
\midrule
R\&D share & 12.5\% \\
Cost\_center & \#4 \\
```

wrapped in `table` and `tabular` environments with booktabs rules and a label you can reference.

**HTML for a blog.** With a caption of "Stadiums", the cell `AT&T Park` is written as `<td>AT&amp;T Park</td>` inside `<thead>` and `<tbody>` sections, and the number column gets `style="text-align: right"`.

## Tips and limits

- Pasted data from Excel and Google Sheets is tab separated, and the tool detects that without asking. Comma, semicolon and pipe separated text also works.
- A cell with a line break becomes `<br>` in Markdown and HTML. LaTeX `tabular` cells cannot hold line breaks, so they become spaces and the tool tells you.
- Markdown tables always need a header row. If your data has none, an empty header row is added and a note explains why.
- For .xlsx files the tool reads every sheet and lets you choose one. Old .xls files (Excel 97–2003) are not supported; save them as .xlsx or CSV first.
- Formulas are not recalculated: the tool uses the value Excel saved in the file. Merged cells, colours and fonts are not carried over.
- Limits: pasted text up to 5 MB, files up to 50 MB, and up to 200 columns. Large files are read in a background worker with a progress bar and a Cancel button. The code box shows the first 200,000 characters; Copy and Download always give you the full result.
- The booktabs style needs `\usepackage{booktabs}` in your preamble. Untick the option to use plain `\hline` rules instead.

## FAQ

**How do I paste an Excel table into GitHub?**
Select the cells in Excel, copy them, paste them here with Markdown selected and click Copy code. Paste the result into your README, issue or pull request; GitHub renders it as a table.

**How do I make a LaTeX table from Excel?**
Choose LaTeX, paste your cells or upload the workbook, and add a caption and label. Special characters such as &, %, $, #, _ and ~ are escaped, so the code compiles as it is.

**Can I choose column alignment?**
Yes. Pick a default (left, center, right, or Auto, which right-aligns number columns) and then change any single column under "Alignment per column".

**Does it keep bold text or cell colours?**
No. It copies the cell values only. You can make the header row bold in LaTeX; in Markdown and HTML, header cells are styled by the page that shows them.

**Why does my number column stay left-aligned?**
Auto only right-aligns a column when every non-empty cell in it is a number. A single "n/a" or "12 pcs" keeps the column left-aligned. Set that column to Right to override it.

**Can I convert only part of a sheet?**
Yes. Type a range such as A1:D20 in the range field. Rows and columns are counted the same way as in Excel.

## Privacy note

Your table never leaves your device. Pasted text and files are read and converted by JavaScript running in your browser tab, and nothing is sent to our servers or anyone else. Nothing is stored either: when you close or reload the page, the data is gone.
