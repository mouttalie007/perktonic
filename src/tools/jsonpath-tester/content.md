---
title: "JSONPath Tester Online: JSONPath and jq, Explained"
metaDescription: "A JSONPath tester online that also runs jq: paste JSON, type an expression, see the live result and a step-by-step explanation of what it does."
h1: "JSONPath Tester Online, with jq"
---

## Hero

This JSONPath tester online runs JSONPath and jq expressions against your JSON as you type. It explains each step in plain words and shows the result. Everything runs in your browser, including jq 1.8 compiled to WebAssembly.

## How to use

1. Paste JSON (up to 5 MB) or open a `.json` file (up to 50 MB). The tool checks it and shows where any syntax error is.
2. Choose JSONPath or jq.
3. Type an expression, or click one of the examples under the box.
4. Read "What this expression does" for the step-by-step explanation, and see the result below it.
5. Copy the result or download it as a file.

## Examples

All three use the sample order export that "Try an example" loads (three orders, five line items).

**JSONPath filter.** `$.orders[?(@.status == 'shipped')].customer.name` is explained as: start at the root, go into "orders", keep only the items where "status" equals "shipped", go into "customer", go into "name". Result, 2 matches:

```
[
  "Ada Lovelace",
  "Katherine Johnson"
]
```

The paths of the matches are listed too: `$['orders'][0]['customer']['name']` and `$['orders'][2]['customer']['name']`.

**jq grouping.** `.orders | group_by(.customer.country) | map({country: .[0].customer.country, revenue: (map(.total) | add)})` gives one output, shown here in compact form:

```
[{"country":"GB","revenue":54.5},{"country":"US","revenue":144}]
```

**jq sorting.** `[.orders[] | {id, total}] | sort_by(.total) | reverse` returns ORD-1044 (126.0), ORD-1042 (54.5) and ORD-1043 (18.0). jq 1.8 keeps numbers as written, so `126.0` stays `126.0`.

## Tips and limits

- JSONPath follows the jsonpath-plus syntax: `$`, `.name`, `['name']`, `[0]`, `[-1:]`, `[0:3]`, `[*]`, `..` for recursive search, `[?(…)]` filters, `~` for property names and `^` for parents. Filters run in a restricted evaluator, not with `eval`.
- Some mistakes are quietly ignored by JSONPath libraries, such as an unclosed `[` or a trailing dot. This tester reports them with the character position.
- jq is the real jq 1.8.2, so `select`, `map`, `group_by`, `reduce`, `@csv`, regex functions and your own `def` functions all work. Turn on "Raw strings (-r)" for CSV lines, and "Compact output (-c)" for one value per line.
- jq keeps large integers exact, such as `12345678901234567890`. JSONPath works on the parsed JavaScript value, so integers above 2^53 lose precision there.
- Each query is stopped after 2 seconds, or a little longer for documents over 2 MB (6.5 seconds at 20 MB), so a runaway regex or loop cannot freeze the page. A Cancel button appears after one second.
- Expressions can be up to 20,000 characters. Results longer than 200,000 characters are cut on screen; Copy and Download always give the full result.
- On a 24 MB file, a JSONPath filter took about 0.3 s and a jq filter about 1.2 s in Chrome on a desktop computer.

## FAQ

**What is JSONPath?**
JSONPath is a query language for picking values out of JSON, much as XPath does for XML. `$.orders[*].id` means "the id of every order". Its standard form is RFC 9535, and most libraries add their own extras.

**How do I filter an array with jq?**
Go through the items with `.[]` and keep the ones you want with `select`: `.orders[] | select(.total > 50)`. Wrap it in brackets, `[.orders[] | select(.total > 50)]`, to get an array back instead of separate values.

**What is the difference between JSONPath and jq?**
JSONPath only selects values that already exist in the document. jq is a full language: it can filter, reshape, compute totals, build new objects and format CSV. JSONPath is common in API tools and configuration files; jq is common on the command line and in scripts.

**Why does my jq filter say "Cannot index array with string"?**
You asked for a key on an array, for example `.orders.name`. Use `.orders[].name` or `.orders | map(.name)`. The tool shows this hint under the error.

**Why do single quotes fail in jq?**
jq strings must use double quotes: `select(.status == "shipped")`. Single quotes are fine inside JSONPath filters.

**Is my JSON uploaded?**
No. Parsing and both query engines run in a Web Worker inside your browser tab.

## Privacy note

Your JSON and your expressions never leave your device. The tool does not upload, log or store them. jq's WebAssembly file is loaded from this website the first time you run a jq filter, and no data is sent with that request. Everything is held only in the tab's memory and is gone when you close or reload the page.
