---
title: "CSV to YAML Converter, plus XML and TOML, Both Ways"
metaDescription: "A free csv to yaml converter that also writes XML and TOML and converts them back to CSV, keeping numbers, booleans, nulls and nested fields intact."
h1: "CSV to YAML Converter (and XML, TOML)"
---

## Hero

This csv to yaml converter turns a spreadsheet export into YAML, XML or TOML, and turns those formats back into CSV. It keeps numbers, booleans and empty values typed, and builds nested sections from dotted column names. It all runs in your browser.

## How to use

1. Pick a direction: CSV → YAML, XML or TOML, or YAML, XML or TOML → CSV.
2. Paste the data or open a file of up to 50 MB. A file's type is recognised from its extension or its first characters.
3. Set the options: the top-level YAML key, the TOML table name, or the XML root and row element names. You can also choose the list separator, whether types are detected, and whether dotted headers are nested.
4. Read the result and the notes underneath, which say what changed or could not be kept.
5. Copy the result or download it as `.yaml`, `.xml`, `.toml` or `.csv`.

## Examples

**Server inventory to YAML** (loaded when the page opens). A CSV with the header `hostname,ip,port,enabled,location.city,location.rack,tags[],owner,notes` becomes:

```
servers:
  - hostname: web-01
    ip: 10.0.4.11
    port: 443
    enabled: true
    location:
      city: Frankfurt
      rack: R12
    tags:
      - frontend
      - public
    owner: platform
    notes: null
```

`port` is a number and `enabled` a boolean. The empty `notes` cell is `null`, and `frontend|public` became a list because the column is named `tags[]`. A note with a line break becomes a `|-` block.

**XML back to CSV.** A catalogue in which each `<book id="bk101" lang="en">` holds `<title>`, `<price>` and `<author><first>…</first><last>…</last></author>` becomes these columns: `title, price, author.first, author.last, in_stock, id, lang`. The tool reports "Rows were taken from “catalog.book” (2 items)". `Midnight &amp; Rain` comes out as `Midnight & Rain`.

**TOML release plan to CSV.** `[[release]]` tables with a `[release.owner]` sub-table become one row per release. `features = ["dark mode", "export"]` is joined as `dark mode|export`. The top-level `title` key is listed as not included, because a CSV holds a single table.

## Tips and limits

These are the rules for nested data:

- Nested objects ⇄ dotted columns: `address.city`.
- Lists of plain values ⇄ one cell joined with the list separator (default `|`). From CSV, name the column `tags[]` to split it again.
- Lists of objects or nested lists cannot be cells. They are written as JSON text in one cell, and the notes say so.
- Only the longest list in a document becomes rows; other top-level keys are reported as not included.
- XML attributes become plain columns. A column is called `@id` only if a child element has the same name.

There are a few more points to know:

- CSV has no types. Numbers and true/false are written as text, and null as an empty cell. TOML has no null, so empty cells are left out and counted in the notes.
- YAML anchors, aliases and `<<` merge keys are resolved. Documents that use aliases to expand into a huge structure are refused.
- Strings such as `yes`, `on`, `007` or `2026-01-01` are quoted in YAML, so YAML 1.1 parsers do not turn them into booleans, numbers or dates.
- XML root and row names must be legal XML names. `2024 servers` is refused with the reason, and headers such as `Unit Price` become `<Unit_Price>`. A DOCTYPE in XML input is refused.
- Speed in Chrome: 500,000 CSV rows (38 MB) become YAML in about 4 seconds, TOML in about 5 and XML in about 7. Reading YAML back is slower, about 1 second per MB.

## FAQ

**How do I convert CSV to YAML?**
Paste the CSV, keep "CSV → YAML" selected and copy the result. Each row becomes a list item, and each header becomes a key.

**What is the difference between YAML and TOML?**
Both are readable configuration formats. YAML uses indentation and supports anchors and references. TOML uses `[sections]` and `key = value` lines, has stricter types, and has no null value.

**How do I set the XML root element?**
Type it in "Root element" (for example `products`), and the name for each row in "Row element" (`product`). Names may not contain spaces or start with a digit.

**Can I keep nested data when going back to CSV?**
Nested objects become dotted columns, so `address.city` survives the round trip. Lists of objects cannot be table cells and are kept as JSON text.

**Why are some of my numbers quoted in the YAML?**
Values such as `007` or `12:30` would change meaning if read as numbers, so they stay strings.

## Privacy note

Your files are converted in a background thread of your browser tab. Nothing is uploaded, logged or stored. The data is gone when you close or reload the page.
