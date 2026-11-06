---
title: "Google Sheets QUERY Builder with Live Preview"
metaDescription: "A google sheets query builder: pick columns, filters, grouping, sorting and labels from menus, copy the =QUERY formula and preview the result on your data."
h1: "Google Sheets QUERY Builder"
---

## Hero

This google sheets query builder writes the `=QUERY()` formula for you. Paste a few rows of your sheet, choose columns, filters, grouping and sorting from menus, and check the result before you paste the formula into Sheets.

## How to use

1. Copy your range in Google Sheets (header row included) and paste it, or choose a CSV file.
2. Type the range the formula should use, for example `Sales!A1:F`, and the number of header rows (0, 1 or 2).
3. Add the columns to show. Pick an aggregate (sum, avg, count, max, min) and an optional header label for each.
4. Add filters, group by columns, an optional pivot column, sorting, and a limit.
5. Check the preview of the first 20 result rows, then copy the formula.

## Examples

**Revenue per region since February.** With the example sales data (24 rows: Date, Region, Rep, Product, Units, Revenue), the tool writes:

```
=QUERY(Sales!A1:F, "select B, sum(F), count(A) where A >= date '2026-02-01' group by B order by sum(F) desc label sum(F) 'Revenue', count(A) 'Orders'", 1)
```

The preview shows West 11826 (5 orders), East 8285 (5), North 6182 (4) and South 5037 (4).

**A name with an apostrophe.** Filtering the Rep column for `Liam O'Brien` gives `where C = ""Liam O'Brien""` inside the formula. QUERY has no escape character, so the tool switches to double quotes and doubles them, as Sheets requires. A value with both ' and " cannot be written in a QUERY at all; the tool says so and suggests reading it from a cell instead.

**Filter from a cell.** Choose "From cell" H1 for the Region filter and H2 for a date filter, and the formula becomes `"select C where B = '"&H1&"' and A >= date '"&TEXT(H2,"yyyy-mm-dd")&"'"`. Change H1 in your sheet and the result updates.

## Tips and limits

- Column names follow your range: a range starting at column C uses C, D, E…. Tick "Use Col1, Col2…" when the data comes from an `{array}` or IMPORTRANGE, where QUERY needs that notation.
- With 0 header rows, the first row is data, so a text header can change a number column into a text column. With 2 header rows, the labels are the two rows joined with a space, as Google does.
- Column types are worked out like Sheets does: the type most cells have wins, and cells of another type count as empty.
- Dates are written as `date 'yyyy-mm-dd'`. The preview reads dates pasted as 2026-01-31 or 1/31/2026.
- Supported in the preview: `select`, `where` (=, !=, <, >, contains, starts with, ends with, like, matches, is null, and, or, not), `group by`, `pivot`, `order by`, `limit`, `offset`, `label`, the aggregates, arithmetic and year, month, day, quarter, dayofweek, hour, minute, upper and lower. `format` and `options` stay in the formula but are not applied in the preview.
- The preview is calculated in your browser, so Google Sheets may differ in rare cases, for example in locale-specific number formats. A `matches` pattern that runs longer than 2 seconds is stopped.
- Limits: pasted data up to 5 MB, CSV files up to 50 MB, 200 columns.

## FAQ

**What is the QUERY function?**
`=QUERY(data, query, headers)` runs a small SQL-like language over a range in Google Sheets. It can filter, group, sum, sort and pivot in one formula, and the result updates when the data changes.

**Why does my QUERY return #VALUE!?**
Usually a column is selected next to an aggregate without being in `group by`, a number is compared with text in quotes, or a date is not written as `date 'yyyy-mm-dd'`. The builder checks these rules and explains the problem before you copy the formula.

**How do I filter by a cell reference?**
Close the quotes, join the cell with &, and reopen them: `"select A where B = '"&H1&"'"` for text, `"… where E > "&H1` for numbers. Use "From cell" in the filter and the tool writes this for you.

**What does pivot do?**
It turns the values of one column into columns. For example `select B, sum(F) group by B pivot D` gives one row per region and one column per product.

**Why are my month numbers one lower?**
QUERY's `month()` counts from 0, so January is 0 and December is 11. Add 1 in the query (`month(A)+1`) if you need 1–12.

**Can I edit the query by hand?**
Yes. Tick "Edit the query text by hand" and the preview runs on your own text, with an explanation if something cannot be read.

## Privacy note

Your data stays in your browser. It is parsed and queried by code running on this page, and nothing is uploaded, logged or stored. When you close the tab, the pasted data is gone.
