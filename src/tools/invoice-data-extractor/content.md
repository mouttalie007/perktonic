---
title: "Invoice Data Extractor Online: Lines, Taxes, Totals"
metaDescription: "Invoice data extractor online: read invoices and receipts into JSON, CSV or Excel, with a check of each field and of the line, tax and total arithmetic."
h1: "Invoice & Receipt Data Extractor"
---
## Hero
This invoice data extractor online reads up to 5 invoices or receipts and returns the vendor, number, dates, line items, taxes and total. Each field is checked against the document and the arithmetic is recomputed, so mistakes are flagged, not hidden.

## How to use
1. Add 1 to 5 files: PDFs (up to 5 pages each) or photos of invoices and receipts (JPG, PNG, WebP, 10 MB each).
2. The text is read in your browser: from the PDF's text layer, or with OCR for photos and scans. Pick the language for photos.
3. Optionally turn on "Hide account numbers before sending", so IBANs and long digit runs keep only their last 4 digits.
4. Press **Extract data**. Each file is one AI request; the page shows how many of your 10 requests per 10 minutes it will use.
5. Review the fields: Verified, Check or Not found, with the line each value came from. Then read the arithmetic checks.
6. Download JSON, CSV (one row per line item) or .xlsx (a summary sheet and one sheet per invoice).

## Examples
**An electrician's invoice in pounds.** Three lines (labour 6 × £45.00 = £270.00, cable, consumer unit) and a subtotal of £450.40 add up, and VAT at 20% is £90.08. But the printed total is £550.48. The tool reports: "Subtotal + taxes = total: expected 540.48, printed 550.48 (difference 10)". It keeps the printed total and does not correct it.

**A French invoice with decimal commas.** "1.043,50 €" is kept exactly as printed and read as 1043.50. The currency is EUR because the euro sign is printed. "Échéance : 14/11/2026" gives the due date 2026-11-14.

**A translation invoice with "Payment: 14 days from the invoice date".** The due date stays empty, because no date is printed and the tool never calculates one. No total is printed, so the total is "Not found" instead of a sum the AI made up.

## Tips and limits
- Every value must be copied as printed. Our server checks that its quoted line is in the text, that the amount is written in that line, and that a date is written in its line. Anything else is marked **Check** with the reason.
- The arithmetic is done by our code: quantity × unit price for each line (to 0.01), the sum of lines against the subtotal, and subtotal plus taxes against the total.
- Amounts in the 1,234.56 and 1.234,56 styles, currency signs, negative discounts and Arabic-Indic digits are read. An amount like "1,234" on an invoice whose style is unclear is flagged as ambiguous.
- For photos, words with OCR confidence below 70 make their field **Check**. A misread such as "3.5O" is not treated as a number.
- A bare "$" is not turned into USD: the currency is set only when a code or a single-currency sign is printed.
- Up to 20,000 characters of text per invoice; longer documents are refused, not cut.

## FAQ
**Can it read invoices in other languages?**
Yes. Values are copied as printed, so French, German, Spanish and Arabic invoices work. For photos, choose the OCR language that matches.

**How accurate is the extraction?**
Do not assume it is right: always verify extracted numbers before you use them. Each field shows whether it was found in the document, and the arithmetic checks show when the numbers do not add up.

**Are my invoices stored?**
No. We do not store your invoices, their text or the results. Only the extracted text is sent, to our server and to the AI provider, to produce the answer.

**Is the file itself uploaded?**
No. PDFs and photos are read in your browser; only the text, and for photos the confidence of each recognised word, is sent.

**Why is a field marked Check?**
Our checks could not confirm it: the quoted line is not in the text, the amount is written differently, the date is not in the line, or the scan was hard to read there.

**How many invoices can I process?**
Up to 5 at a time. Each one uses one of your 10 AI requests per 10 minutes.

## Privacy note
Invoices contain personal and financial data. Files are read in your browser; only the extracted text (with account numbers hidden if you turn that on) is sent, to our server and to the AI provider, to produce the answer. We do not store it with your identity, and identical requests may be answered from a short-lived cache. The exports are created on your device.
