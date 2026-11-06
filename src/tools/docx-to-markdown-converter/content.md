---
title: "DOCX to Markdown Converter, Pandoc-Style, in Your Browser"
metaDescription: "A docx to markdown pandoc converter that runs in your browser: Word to Markdown with images in a ZIP and footnotes, and Markdown back to a .docx file."
h1: "DOCX to Markdown Converter (and Markdown to Word)"
---

## Hero

This docx to markdown pandoc converter turns Word documents into clean Markdown and Markdown back into .docx, without installing Pandoc. Headings, lists, tables, links, images and footnotes are kept, and anything that cannot be converted is listed with a count.

## How to use

1. Choose "Word → Markdown" or "Markdown → Word".
2. Open a .docx file of up to 50 MB, or paste Markdown (or open a .md file).
3. For Word files, choose how to handle images: extracted into an `images/` folder in a ZIP, or kept inside the Markdown as data URIs.
4. Read "What changed in the conversion". It lists every feature that was changed or left out, with how many times it occurred.
5. Copy the Markdown, or download the .md, the ZIP or the .docx.

## Examples

**A project brief from Word** (loaded when the page opens). The brief has a title, three sections, a nested bullet list, a numbered list, a budget table, a chart image, two footnotes, a comment, a tracked change, an equation, a text box and a page header and footer. Part of the result:

```
## Goals

- Cut checkout to two steps
  - Address lookup by postcode
- Add wallet payments[^2]

| **Item** | **Owner** | **Cost (EUR)** |
| --- | --- | --- |
| Design sprint | Ada | 6,000 |

![Conversion by checkout step](images/image1.png)

[^2]: Apple Pay and Google Pay, behind a feature flag.
```

The warnings list says: 2 footnotes converted, 1 comment not included, 2 tracked changes accepted (the "10%" insertion kept, the "50%" deletion removed), 1 text box flattened, 1 equation not converted, and 2 headers and footers not included.

**Release notes to Word.** Markdown with a table, a `js` code block, a task list, a footnote and an embedded PNG becomes a .docx with Word's Heading styles, a real table, a "Source Code" paragraph style in Courier New, a Word footnote and the picture. The page then reads the new file back as Markdown, so you can check what Word will show. It also notes that the code-block language name was dropped and that `diagrams/old-flow.png` could not be embedded, because it was a path rather than image data.

## Tips and limits

- **Kept:** headings, bold, italics, links, nested bullet and numbered lists, tables, images, footnotes and endnotes. Paragraphs in Word's code styles ("Source Code", "Code", "HTML Preformatted") become fenced code blocks, and quote styles become blockquotes.
- **Changed, with a warning:** tracked changes are accepted as in Word's final view. Text boxes become plain paragraphs. A table without a header row gets its first row as the header. Merged cells are split, because Markdown tables cannot merge.
- **Not converted, with a warning:** comments, equations, page headers and footers, charts, SmartArt and embedded objects.
- **Fonts, colours and spacing** are not carried over. Markdown has no notion of them, and Word applies its default styles on the way back.
- **Markdown → Word:** images are embedded only when they are inside the Markdown as data URIs (PNG, JPEG or GIF). Images on the web are never downloaded, so their alt text and address are written instead. Raw HTML is kept as plain text.
- **Not supported:** old .doc files (Word 97–2003) and PDFs are refused with a message. Save the file as .docx first.
- **Size:** files up to 50 MB, and pasted Markdown up to 5 MB. A 45 MB report with 45 images and 3,000 paragraphs converted in about 3 seconds in Chrome, and the page stayed responsive because the work runs in a background thread.

## FAQ

**How do I convert Word to Markdown?**
Open the .docx file on the "Word → Markdown" tab. Then copy the Markdown, or download it as a ZIP with its images.

**Are images kept?**
Yes. By default they are saved as `images/image1.png` and so on inside a ZIP, next to `document.md`. You can also embed them in the Markdown as data URIs, which makes a single, larger file.

**Why is my formatting different?**
Markdown records structure, not appearance: headings, lists, emphasis and tables survive, but fonts, colours, page layout and spacing do not. Features without a Markdown equivalent, such as comments or equations, are listed under "What changed".

**Does it keep footnotes?**
Yes. Word footnotes and endnotes become Markdown footnotes (`[^1]` with the note at the end), and in the other direction they become real Word footnotes.

**Is this the same as Pandoc?**
No. It uses open-source JavaScript libraries (mammoth, turndown, marked and docx) that run in your browser, so there is nothing to install. Pandoc supports more formats, but for everyday Word and Markdown documents this covers the common cases and tells you what it did not convert.

## Privacy note

Your documents are converted in a background thread of your browser tab. Nothing is uploaded, logged or stored, and the files are discarded when you close or reload the page.
