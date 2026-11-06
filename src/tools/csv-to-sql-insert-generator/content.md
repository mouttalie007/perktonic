---
title: "CSV to SQL INSERT Generator: MySQL, PostgreSQL, SQLite"
metaDescription: "A CSV to SQL INSERT generator for MySQL, PostgreSQL, SQLite and SQL Server: detects column types, escapes values and writes batched INSERT statements."
h1: "CSV to SQL INSERT Generator"
---

## Hero

This CSV to SQL INSERT generator turns a CSV file into a CREATE TABLE statement and batched INSERT statements for MySQL, PostgreSQL, SQLite or SQL Server. It detects column types and escapes every value. Nothing leaves your browser.

## How to use

1. Paste CSV or open a file of up to 50 MB. Commas, semicolons, tabs and pipes are detected, and so is the file's encoding (UTF-8, UTF-16, Windows-1252 or Windows-1256). You can override the encoding.
2. Pick the SQL dialect and type a table name.
3. Check the column list: each column shows the detected type and why it was chosen. Change a type or a name if needed, and pick a primary key.
4. Choose what to output: CREATE TABLE, DROP TABLE IF EXISTS, INSERTs, a transaction, and the number of rows per INSERT.
5. Copy the SQL or download it as a `.sql` file.

## Examples

**A customer export** (loaded when the page opens). The header `Customer ID,Full Name,Email,Signup Date,Last Login,Lifetime Value (€),Is Active,ZIP,Group,Notes` becomes these PostgreSQL columns: `customer_id INTEGER`, `full_name VARCHAR(32)`, `signup_date DATE`, `last_login TIMESTAMPTZ` (one value ends in `Z`), `lifetime_value NUMERIC(6,2)`, `is_active BOOLEAN`, `zip VARCHAR(16)` and `"group" VARCHAR(16)`. The ZIP column stays text because `02134` has a leading zero. `group` is quoted because it is a reserved word.

**Quotes, NULLs and backslashes.** The row `1003,"O'Brien, Seán",…,,0,false,D02 X285,,"Said: ""call me back"""` becomes this MySQL row:

```
(1003, 'O''Brien, Seán', 'sean@example.ie', '2025-01-20', NULL, 0, 0, 'D02 X285', NULL, 'Said: "call me back"')
```

The empty `Last Login` and `Group` cells become `NULL`. A value such as `C:\temp\export` is written as `'C:\\temp\\export'` for MySQL, which treats backslashes as escapes, and unchanged for the other three dialects.

**A large file.** A 38 MB CSV with 500,000 rows produced 5,003 statements (CREATE TABLE, BEGIN, 5,000 INSERTs of 100 rows, COMMIT), about 50 MB of SQL, in 2.6 seconds in Chrome.

## Tips and limits

- Types are detected from the first 10,000 rows: integer, big integer, decimal (with precision and scale), boolean (true/false, yes/no), date (YYYY-MM-DD) and timestamp (with or without a time zone). Anything else is text.
- Every row is still checked when the SQL is written. If a value does not fit its column type (for example `n/a` in an integer column), the tool tells you the column, the row number and the value.
- Dates such as 28/10/2026 stay text, because 03/04/2026 could be March or April. Convert them to YYYY-MM-DD first, or keep the column as text.
- Column names are cleaned into lower snake case: `Lifetime Value (€)` becomes `lifetime_value` and `Größe` becomes `grosse`. Duplicates get `_2`, and names are cut to the dialect's limit (63 characters in PostgreSQL). Reserved words are quoted with backticks, double quotes or brackets, depending on the dialect.
- Empty cells become `NULL`. Tick the option to write `''` in text columns instead, or to read the text `NULL` and `\N` as NULL.
- SQL Server accepts at most 1,000 rows per INSERT, so larger batch sizes are capped there.
- The screen shows the first 200,000 characters; Copy and Download always give the full script.
- The tool only writes text. It never connects to a database.

## FAQ

**How do I import a CSV into MySQL?**
Generate the script with the MySQL dialect, then run it with `mysql -u user -p database < customers.sql` or paste it into MySQL Workbench. For very large files, MySQL's own `LOAD DATA INFILE` is faster.

**What types does the tool detect?**
Integer, big integer, decimal, boolean, date, timestamp and text. Each column shows the reason for its type, such as "all 5 filled values are whole numbers", and you can change it.

**Can it generate only the CREATE TABLE?**
Yes. Untick "INSERT statements" to get just the table definition, or untick "CREATE TABLE statement" to get only the data.

**Why is my ZIP code column text, not a number?**
At least one value starts with 0. Storing it as a number would turn 02134 into 2134.

**Is the SQL safe from injection?**
Every value is written as an escaped literal, and every name is cleaned and quoted where needed. Still, review any script before running it on a production database.

## Privacy note

The CSV is read and converted inside your browser, in a background thread. It is never uploaded, logged or stored, and the tool makes no network requests with your data. The data stays in the page's memory until you close or reload it.
