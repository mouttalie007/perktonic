---
title: "JSON Data Formatter and Validator with Schema Check"
metaDescription: "A json data formatter and validator that beautifies or minifies JSON, shows errors by line and column, and checks it against draft-07 or 2020-12 schemas."
h1: "JSON Data Formatter and Validator"
---

## Hero

This json data formatter and validator beautifies or minifies JSON, points to syntax errors by line and column, and checks the data against a JSON Schema. Large integers and decimals are kept exactly.

## How to use

1. Paste JSON or choose a .json file.
2. Pick the output: beautified with 2 spaces, 4 spaces or tabs, or minified. Tick "Sort keys A→Z" to order every object.
3. If the input has comments or trailing commas (JSONC, as in many config files), tick "Allow comments and trailing commas".
4. Open the Tree tab to browse the structure and copy a path such as `$.items[0].sku`.
5. Optionally paste a JSON Schema to validate the data, then copy or download the result.

## Examples

**A missing comma.** In this input

```
{
  "id": 1042,
  "status": "paid"
  "total": 129.9
}
```

the tool reports: "Not valid JSON at line 4, column 3: Expected a comma or } after the value, but found the start of another string. A comma is probably missing." Under the message it shows line 4 with a ^ under the quote, so the missing comma is easy to spot at the end of line 3.

**A 64-bit ID.** The example order has `"id": 9007199254740993` and `"total": 129.90`. Most tools that use JSON.parse print 9007199254740992 and 129.9. This tool writes back the exact digits and reports "1 integer(s) larger than 2^53 kept exactly".

**A schema check.** Against a draft-07 schema with `"port": {"type": "integer", "maximum": 65535}` and `"additionalProperties": false`, the data `{"port": 70000, "hosts": [], "debug": true}` gives three problems: `$.port` is greater than 65535, `$.hosts` has too few items, and `$.debug` is not allowed. Each one comes with its line and column.

## Tips and limits

- Error messages explain the usual causes: single quotes, unquoted keys, trailing commas, comments, NaN or True (Python), leading zeros and text after the end of the document.
- Duplicate keys are reported with their position. Most parsers silently keep only the last value.
- Sorting compares keys character by character, so the order is the same in every browser. Keys such as "10" and "2" stay in text order ("10" first), and objects with duplicate keys keep their order.
- Numbers and strings are written exactly as in the input, including escapes like `é`. In lenient mode, comments and trailing commas are removed from the output.
- Schemas: draft 2020-12, 2019-09, draft-07 and draft-04, taken from `$schema` or chosen by hand. Validation compares integers above 2^53 as ordinary numbers, and is stopped if a `pattern` makes it run longer than 2 seconds.
- Limits: pasted text up to 5 MB, files up to 50 MB. Large files are processed in the background: a 50 MB file took about 8 seconds in our test, and the page stayed responsive. The text box shows the first 200,000 characters; Download always has everything. Copy works up to 5 MB.

## FAQ

**Why does my JSON say unexpected token?**
Something is in a place where JSON does not allow it, often a missing comma, a trailing comma, a comment or single quotes. This tool names the character and shows the exact line and column.

**How do I validate JSON against a schema?**
Paste the data, then paste the schema in the third box. Problems appear as a list of paths, each with a line number and a plain message.

**How do I minify JSON?**
Choose "Minify" as the output, then copy or download. Spaces and line breaks are removed; values are unchanged.

**Is JSON with comments valid?**
No. Standard JSON has no comments, but JSONC (used by VS Code and tsconfig files) allows them. Lenient mode reads JSONC and writes plain JSON.

**Why are big numbers changed by other tools?**
JavaScript stores numbers as 64-bit floats, which are exact only up to 9,007,199,254,740,991. This tool keeps the original digits instead of converting them.

**What does the path $.items[0].sku mean?**
`$` is the whole document, `.items` a key, `[0]` the first array element and `.sku` a key inside it. Keys with spaces are written as `['first name']`.

## Privacy note

Your JSON and schema are processed only in your browser. Nothing is uploaded, logged or stored, and the page makes no requests containing your data. Closing the tab removes everything.
