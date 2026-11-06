---
title: "Text to Mermaid Diagram Generator: Live Preview, PNG & SVG"
metaDescription: "A text to mermaid diagram generator with live preview: write flowchart, sequence, ER, Gantt, state or class code and export PNG, SVG or PDF in your browser."
h1: "Text to Mermaid Diagram Generator"
---

## Hero

This text to mermaid diagram generator turns a few lines of Mermaid code into a flowchart, sequence, ER, Gantt, state or class diagram. You see it as you type and can save it as PNG, SVG or PDF.

## How to use

1. Pick a template (flowchart, sequence, ER, Gantt, state or class) and click Insert, or press Try an example.
2. Edit the code. The preview updates about a third of a second after you stop typing.
3. Choose the Light or Dark theme.
4. If a line is wrong, the error box names the line and shows its text, and the last working diagram stays on screen.
5. Export: PNG at twice the drawing size, SVG for editing or printing, or PDF through your browser's print dialog ("Save as PDF").

## Examples

**An order process flowchart.** The example starts like this:

```
flowchart TD
    A[Customer places order] --> B{Payment approved?}
    B -- Yes --> C[Reserve stock]
    B -- No --> D[Email payment failure]
```

It renders as a top-down chart with a diamond for each decision and labelled Yes/No arrows. The PNG export of the full example is about 1,350 pixels wide.

**A syntax error.** In this code, line 4 has an arrow that points to another arrow:

```
flowchart TD
    A[Start] --> B{Valid?}
    B -- Yes --> C[Save]
    B -- No --> -->
```

The tool shows: "Line 4: Mermaid did not expect another arrow here. A node, arrow target or closing bracket is probably missing." Below it is the line itself, `B -- No --> -->`.

**A project plan.** The Gantt template uses `dateFormat YYYY-MM-DD` and tasks such as `Content audit :active, d2, after d1, 4d`. Each bar starts where the task it depends on ends, so moving one date moves everything after it.

## Tips and limits

- Supported diagram types: flowchart (and graph), sequenceDiagram, erDiagram, gantt, stateDiagram-v2 and classDiagram. Other Mermaid types are rejected with a message.
- Code can be up to 20,000 characters. Above 5,000 characters the preview stops updating on every key press and shows a Render button instead, because laying out a big diagram can take two or three seconds.
- Diagrams are drawn in Mermaid's strict security mode. `click` lines and links are ignored, HTML inside labels is shown as text or removed, and a `%%{init}%%` directive cannot switch strict mode off.
- Labels are drawn as SVG text rather than HTML. That keeps the PNG export working, but Markdown formatting inside labels (bold, line breaks with `<br>`) is limited.
- The PNG is drawn at twice the diagram's size. Very large diagrams are scaled down so they stay within browser canvas limits (about 16,000 pixels per side).
- For PDF, the tool opens the print dialog with only the diagram on an A4 page (landscape for wide diagrams); choose "Save as PDF" as the printer. The PDF keeps text as vector shapes.
- Nothing is generated from plain-English descriptions yet; you write or paste the Mermaid code yourself.

## FAQ

**How do I turn text into a flowchart?**
Start with `flowchart TD`, then write one connection per line, such as `A[Sign up] --> B[Confirm email]`. Square brackets make boxes, curly braces make decision diamonds, and `-- Yes -->` adds a label to an arrow.

**What is Mermaid?**
Mermaid is an open-source language for describing diagrams in plain text. GitHub, GitLab, Notion and many documentation tools render it directly, so the same code works in a README.

**Can I export a diagram as PNG?**
Yes. Click PNG (2×) to download a sharp image with a white or dark background, depending on the theme you chose.

**Which export should I use for slides or print?**
SVG or PDF. Both stay sharp at any size; PNG is best for chat apps and places that do not accept SVG.

**Why doesn't my diagram show up?**
Check the first line: it must name a diagram type, such as `sequenceDiagram`. Then read the error box, which points to the line Mermaid could not understand.

**Does it work offline?**
Once the page and the diagram engine have loaded, rendering and exporting happen without the network. The engine (about 200 KB) downloads the first time you render a diagram.

## Privacy note

Your Mermaid code is rendered and exported entirely in your browser. It is never uploaded, logged or stored by us, and the page sends no network requests containing it. When you close or reload the tab, the code is gone unless you copied or downloaded it.
