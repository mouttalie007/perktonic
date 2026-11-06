---
title: "Extract Table from PDF to Excel: Private, In-Browser"
metaDescription: "Extract tables from a PDF to Excel in your browser: ruled and borderless tables, tables over several pages and merged headers, with a preview first."
h1: "Extract Tables from a PDF to Excel"
---
## Hero
Extract tables from PDF to Excel without uploading the file. The PDF is read in your browser. Every table it finds is shown in a preview, and you download the ones you want as one .xlsx file.

## How to use
1. Choose a PDF (up to 20 MB and 50 pages). If you only need some pages, type a range such as "1-3, 5".
2. Wait a moment while the pages are read. A progress bar shows each page, and you can cancel.
3. Check each table in its preview. Untick the ones you do not need, and turn "First row is a header" on or off.
4. Choose how numbers are written (1,234.56 or 1.234,56), or leave it on Automatic.
5. Press **Download .xlsx**. You get one sheet per table, named like "Table 1 (p2)", or all tables on one sheet if you prefer.

## Examples
**A supplier invoice with a ruled table.** The SKU column "00417" stays text, so the leading zeros are kept. Quantities and prices such as "8.90" become numbers you can add up. The sheet is called "Table 1 (p1)" and its header row is bold and frozen.

**A bank statement over three pages.** The header "Date | Description | Reference | Amount" is printed at the top of every page. The tool joins the pages into one table of 65 rows, removes the repeated header twice, and tells you it did.

**A report with a merged header.** "Revenue" spans the "Q1" and "Q2" columns. In Excel it becomes a merged cell over two columns. In the preview its text is repeated in both columns so you can check it.

## Tips and limits
- Two methods find tables. **Ruled lines** uses the cell borders drawn in the PDF. **Text alignment** groups words into rows and finds columns shared by at least three rows. Automatic uses ruled lines where there are some and alignment elsewhere, and you can force either one.
- Complex layouts need checking in the preview. Text alignment is labelled "check the columns" for that reason.
- Identifiers with leading zeros, phone numbers, anything starting with "+", and dates stay text. A cell that starts with "=" is never written as a formula.
- Right-to-left tables (Arabic, Hebrew) keep their reading order, and the sheet opens right to left.
- Rotated pages are read in the orientation you see on screen.
- Scanned PDFs have no text layer. The tool detects this and points you to the scanned-table tool, which uses OCR.
- Password-protected PDFs open after you type the password. It stays in your browser.
- The work stops after 60 seconds. For long documents, use a page range.

## FAQ
**How do I extract a table from a PDF to Excel?**
Open the PDF here and check the preview of each table. Then press Download .xlsx; each table you ticked becomes a sheet.

**Why is my table split into two?**
A table that continues on the next page is joined only when its columns line up with those of the previous page. If the layout changes, or a page in between is not in your range, you get two tables. Tick both and use "All tables on one sheet".

**Does it work with scanned PDFs?**
No. A scan is an image without text, and this tool says so when it sees one. The Scanned Table to Spreadsheet tool reads scans with OCR, also in your browser.

**Why are some numbers left as text?**
Values like 00417, +44 20 7946 0958 or 2026-09-04 are identifiers, phone numbers or dates. Turning them into numbers would lose zeros or change them, so they stay as written.

**Can I copy a table instead of downloading it?**
Yes. Each preview has a Copy button that copies tab-separated cells, which paste directly into Excel or Google Sheets.

**Is my PDF uploaded?**
No. The file never leaves your device: a worker in your browser reads it, and nothing is sent to a server.

## Privacy note
Your PDF is read and converted entirely in your browser, inside a Web Worker. It is not uploaded, stored or logged, and the page sends no request with your data. Closing the tab discards everything. The .xlsx file is created on your device.
