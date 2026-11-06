---
title: "PDF to CSV Table Converter Online: Private, No Upload"
metaDescription: "PDF to CSV table converter online: find the tables in a PDF, choose the delimiter and encoding, and download CSV files or a ZIP, all in your browser."
h1: "PDF to CSV Table Converter"
---
## Hero
This pdf to csv table converter online finds the tables in a text-based PDF and writes each one as a CSV file. You choose the delimiter, the encoding and the line endings. The PDF never leaves your browser.

## How to use
1. Choose a PDF (up to 20 MB and 50 pages), and type a page range such as "2-4" if you need only part of it.
2. Check the tables found. Each one has a grid preview and a preview of the CSV text exactly as it will be written.
3. Pick the delimiter (comma, semicolon, tab or pipe), the encoding and the line endings.
4. Keep "Protect against spreadsheet formulas" on if the file will be opened in Excel or Google Sheets.
5. Download one CSV per table: a single file for one table, or a ZIP for several. You can also download one combined CSV with a "table" column.

## Examples
**One invoice table, comma, UTF-8 with BOM.** The download is `invoice-table-1-p1.csv`:
`Item,Qty,Unit price,Amount` and `Laser paper A4 (box),12,24.50,294.00`. A description that contains a comma is quoted: `"Gloves, box of 100"`.

**Two tables on one page, semicolon.** The ZIP holds `table-1-p1.csv` and `table-2-p1.csv`, in page order, and each file starts with `Office;2025;2026`. With "One combined CSV", you get one file whose first column is the table number.

**A cell that looks like a formula.** `=SUM(A1:A9)` is written as `'=SUM(A1:A9)`, and `+44 20 7946` as `'+44 20 7946`. A plain number such as `-12.50` is left alone.

## Tips and limits
- Tables are found with the same engine as the PDF to Excel tool. It reads ruled tables from their cell borders and borderless tables from text alignment, and joins tables that continue over several pages (a repeated header is dropped).
- Values are written exactly as printed in the PDF: "1.234,56" stays "1.234,56". Choose the delimiter to match: semicolon is safer when the numbers use decimal commas.
- Encodings: UTF-8, UTF-8 with BOM (best for Excel), Windows-1252, ISO-8859-1 and UTF-16 LE with BOM. A character the encoding cannot hold (for example "€" in ISO-8859-1, or any Arabic text in Windows-1252) becomes "?", and the page tells you how many were replaced.
- Merged cells keep their text in the first cell only, as in the PDF.
- Scanned PDFs (no text layer) are detected and sent to the Scanned Table tool. Password-protected PDFs open with their password.
- Complex layouts need checking in the preview, especially tables found by alignment.

## FAQ
**How do I convert a PDF table to CSV?**
Open the PDF here, check the preview and press Download. One table gives one .csv file; several give a ZIP with predictable names (table-1-p2.csv).

**Which delimiter should I choose?**
Comma is the standard. Use semicolon if your spreadsheet uses decimal commas (common in Europe), tab for pasting into other programs, and pipe when the data itself contains many commas and semicolons.

**Why are numbers split into several columns?**
A comma inside a number such as "1,234" can collide with the delimiter if a program reads the file with the wrong settings. Values are always quoted correctly here, so open the file with the same delimiter, or pick semicolon.

**Which encoding works with Excel?**
UTF-8 with BOM. Without the BOM, older versions of Excel may show accented letters and Arabic text as garbled characters.

**What does "Protect against spreadsheet formulas" do?**
It puts an apostrophe before text that starts with =, +, - or @ (and is not a plain number), so a spreadsheet shows it as text instead of running it.

**Is my PDF uploaded?**
No. Reading, conversion and the ZIP all happen in your browser.

## Privacy note
The PDF is read in your browser, in a Web Worker, and the CSV files and ZIP are created on your device. Nothing is uploaded, stored or logged, and the page makes no request with your data. Closing the tab discards everything.
