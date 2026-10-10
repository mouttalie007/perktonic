"use client";

import { useState } from "react";
import { Node, mergeAttributes, type NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

/**
 * A pasted `[IMAGE: <prompt>]` marker (see markersToPlaceholderHtml,
 * quick-article.ts), rendered as a click-then-Ctrl+V drop zone.
 *
 * Deliberately has NO paste handler of its own (a first version did, and
 * it silently did nothing — `contentEditable={false}` elements don't
 * reliably fire native `paste` events in the browser, since there's no
 * editable surface to paste into). Instead, clicking the box selects it as
 * the editor's current ProseMirror selection (a NodeSelection around this
 * atomic node) and focuses the real contenteditable root. RichTextEditor's
 * existing `handlePaste` already replaces *whatever is currently selected*
 * with the pasted/uploaded image — that already-working mechanism is what
 * actually does the work here; this component only has to make sure the
 * right thing is selected when Ctrl+V happens.
 */
export const ImagePromptNode = Node.create({
  name: "imagePrompt",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      prompt: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-image-prompt]",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const raw = el.getAttribute("data-image-prompt");
          return { prompt: raw ? decodeURIComponent(raw) : "" };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-image-prompt": encodeURIComponent(node.attrs.prompt as string),
      }),
      `[IMAGE: ${node.attrs.prompt}]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePromptNodeView);
  },
});

function ImagePromptNodeView({ node, editor, getPos, selected }: NodeViewProps) {
  const prompt = node.attrs.prompt as string;
  const [copied, setCopied] = useState(false);

  function select() {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null || pos === undefined) return;
    editor.chain().focus().setNodeSelection(pos).run();
  }

  async function copyPrompt(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the prompt text is still visible to select by hand */
    }
  }

  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      tabIndex={0}
      onClick={select}
      onFocus={select}
      className={`border-brand-ink bg-brand/10 hover:border-ink relative my-2 cursor-pointer rounded-sm border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none ${selected ? "border-solid ring-2 ring-[var(--color-brand-ink)]" : ""}`}
    >
      <p className="text-ink text-sm font-semibold">
        📷 {selected ? "Selected — press Ctrl+V to paste the image" : "Click here, then press Ctrl+V to paste the image"}
      </p>
      <p className="text-muted mt-1 text-xs italic">{prompt}</p>
      <button
        type="button"
        onClick={copyPrompt}
        className="border-line bg-white mt-2 rounded-sm border px-2 py-1 text-xs font-bold hover:bg-surface"
      >
        {copied ? "Copied!" : "Copy prompt"}
      </button>
    </NodeViewWrapper>
  );
}
