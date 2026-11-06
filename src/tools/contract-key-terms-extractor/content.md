---
title: "Contract Key Terms Extractor: Dates, Payments, Clauses"
metaDescription: "Contract key terms extractor: paste a contract and list its parties, dates, payments, renewal and termination terms, each with its clause and source quote."
h1: "Contract Key Terms Extractor"
---
## Hero
**This is not legal advice. The tool can miss or misread clauses; a qualified professional must review the contract.** This contract key terms extractor lists what a contract says about parties, dates, money, renewal and termination, with the exact clause for each term.

## How to use
1. Paste the contract (up to 20,000 characters), or open a .txt or .docx file. The file is read in your browser.
2. Remove any names and amounts you do not want to send.
3. Optionally, type what to look for in "Anything specific to look for?" (300 characters), for example "notice periods and penalties".
4. Press **Extract key terms**.
5. Read the terms, grouped by category. Click **Show in the contract** to select the quoted clause in the text box.
6. Download a CSV or a Markdown checklist, or copy the list. Both files start with the disclaimer above.

## Examples
**A services agreement** (8 clauses):
- Payment: "£4,500 per month, plus VAT", normalised to 4,500 GBP, clause 3.1.
- Renewal: renews automatically for 12 months unless notice is given at least 60 days before the end of the term (clause 4.1).
- Liability: capped at the fees paid in the 12 months before the claim (clause 7.1).
- Governing law: England and Wales (clause 8.1).

**A US commercial lease extract:**
- Start date "May 1, 2026" becomes 2026-05-01, from Section 2.
- Base rent "$3,250.00 per month" becomes 3,250 USD.
- Not found in this text: Renewal, Obligations, Confidentiality, Liability.

**A focus question "Is this contract enforceable?":** the terms are still listed. A note explains that the tool cannot judge validity or enforceability.

## Tips and limits
- Every term carries the clause it comes from. If that quote is not in your text, the term is removed and the page says how many were removed.
- Dates and amounts are converted (to 2026-05-01, or to 3,250 USD) only when they are written in the quoted clause. "30 days after signing" stays as words and is never turned into a computed date.
- A clause number is shown only when it appears in the quote or on the line above it.
- Categories with nothing found are listed under "Not found in this text". They are never filled with a "typical" value. Check annexes and schedules, which are often separate documents.
- The limit is 20,000 characters, about 3,000 words. This version does not split long contracts: paste them in parts.
- PDF is not supported yet. Copy the text out of the PDF and paste it here.
- Works best in English. French and other languages are read too, but dates and amounts in them are verified less often.

## FAQ
**Is this legal advice?**
No. The tool lists what the text says. It can miss or misread clauses, and it does not judge whether a clause is fair, valid or enforceable. A qualified professional must review the contract.

**What does it extract from a contract?**
Parties, effective date, term or expiry, payment, renewal, termination, obligations (with whose they are), governing law, confidentiality, liability, and other notable terms. Each comes with a short value and the quoted clause.

**Is my contract confidential?**
The text goes to our server and to the AI provider to produce the list. We do not store it with your identity. Remove names and amounts you do not want to send before you press the button.

**Can I ask whether a clause is enforceable?**
You can type the question, but it is not answered. The extraction still runs, and a note says the tool cannot judge that.

**Why is a category marked "Not found in this text"?**
Nothing in the pasted text states it. The term may be in an annex or a document the contract refers to, or the contract may simply not cover it.

**Can I open it in Excel?**
Yes. The CSV is UTF-8 with a byte-order mark, so accents display correctly. Cells that start with = + - or @ are prefixed so they cannot run as formulas.

## Privacy note
When you press Extract key terms, the contract text and your focus question are sent to our server and to the AI provider to produce the list. Files are read in your browser first, and only their text is sent. We do not store the text with your identity. An identical request may be answered from a short-lived cache. Nothing is sent when the page opens: the example result was saved in advance.
