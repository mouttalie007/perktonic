---
title: "Excel Formula to SQL Converter (and Python pandas)"
metaDescription: "Excel formula to SQL converter: turn SUMIFS, lookups and IF chains into PostgreSQL, MySQL, SQLite, SQL Server or pandas, with a mapping and a syntax check."
h1: "Formula to SQL / Python (pandas) Converter"
---
## Hero
Paste a spreadsheet formula or describe the calculation. This excel formula to SQL converter writes the equivalent query or pandas code and shows which piece became which. It also lists what it had to assume.

## How to use
1. Paste a formula such as `=SUMIFS(C:C,A:A,"North")`, or describe the logic in a sentence (up to 4,000 characters).
2. Optionally list the table and columns with their types, for example `sales(region text, order_date date, amount numeric)`. Without them, the tool states which names it assumed.
3. Pick the target: PostgreSQL, MySQL, SQLite, SQL Server or Python pandas.
4. Press **Convert**. Read the syntax-check line, the mapping table and the warnings, then copy the code or download it as .sql or .py.

## Examples
**A SUMIFS filled down a list of regions.** `=SUMIFS(Sales!$C:$C,Sales!$A:$A,$A2,Sales!$B:$B,">="&DATE(2026,1,1))` for PostgreSQL becomes `SELECT region, SUM(amount) AS total_amount FROM sales WHERE order_date >= DATE '2026-01-01' GROUP BY region ORDER BY region;`. The syntax check says the query parses as PostgreSQL. One of the notes: regions with no sales do not appear, while the spreadsheet showed 0.

**A lookup.** `=VLOOKUP(B2,Products!A:C,3,FALSE)` for SQLite becomes a `LEFT JOIN products … ON p.code = o.product_code`. LEFT keeps orders whose product is missing, as NULL, just as the spreadsheet showed #N/A.

**A grade ladder in pandas.** `=IF(C2>=90,"A",IF(C2>=75,"B",IF(C2>=60,"C","F")))` becomes `np.select(conditions, choices, default="F")`, with `import numpy as np` and `import pandas as pd` at the top.

## Tips and limits
- The tool translates the usual patterns:
  - SUMIFS and COUNTIFS → `GROUP BY` with a filter;
  - VLOOKUP, XLOOKUP and INDEX/MATCH → `LEFT JOIN` (pandas `merge(how="left")`);
  - IF chains → `CASE WHEN` (pandas `np.select`);
  - SUMPRODUCT of conditions → `SUM(CASE WHEN …)`;
  - running totals → window functions (pandas `cumsum`).
- SQL is syntax-checked on our server with the parser of the chosen dialect. A failure is shown with the parser's message, and the code is still displayed. A few constructs our checker does not support (PIVOT, MERGE, LIKE … ESCAPE) are labelled "not checked".
- Python code is not run and not syntax-checked. The page lists its import lines and checks that brackets and quotes are balanced.
- **The tool never runs your code and never connects to a database.** Test the query on a copy first.
- Some spreadsheet features have no exact equivalent, and our own code flags them: approximate-match VLOOKUP, volatile functions (TODAY, NOW, RAND, OFFSET, INDIRECT) and array formulas.
- The table description can be up to 2,000 characters. You can send 10 AI requests per 10 minutes.

## FAQ
**Can SQL replace my Excel formulas?**
For summaries, filters and lookups over many rows, yes, and it is usually faster. Cell-by-cell logic that refers to the row above or to other sheets needs window functions or joins, and the mapping shows how each part changed.

**How do I do a VLOOKUP in pandas?**
Use `left.merge(right, how="left", left_on="code", right_on="code")`. Rows without a match get NaN, the pandas version of #N/A. For an approximate match on sorted keys, use `pd.merge_asof`.

**What about pivot tables?**
A pivot table is a GROUP BY: rows become grouped columns and values become SUM or COUNT. In pandas, use `pivot_table(index=…, columns=…, values=…, aggfunc="sum")`.

**Which SQL dialect should I pick?**
The one your database uses. Dates, TOP versus LIMIT and some functions differ, and the syntax check uses the dialect you pick.

**Why does the result list assumptions?**
A formula refers to columns like C:C, not to names. When you do not give the schema, the tool says which table and column names it chose. It also says how blank cells (NULL) are treated.

**Will the converted query give exactly the same numbers?**
Usually, but check the notes: SQL skips NULLs, text comparison can be case-sensitive, and groups with no rows disappear instead of showing 0.

## Privacy note
When you press Convert, the formula or description and the table description are sent to our server and to the AI provider to produce the code. The code is checked on our server but never run, and no database is contacted. We do not store the text with your identity, and identical requests may be answered from a short-lived cache. The example shown when the page opens is saved in the page and sends nothing.
