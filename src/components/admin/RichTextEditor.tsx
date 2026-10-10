"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadImageDirect } from "@/app/actions/admin-media";
import { ImagePromptNode } from "./image-prompt-node";
import { markersToPlaceholderHtml } from "@/lib/quick-article";

/**
 * The article/page rich text editor (per the original brief: "an advanced
 * editor that helps write the article and can be given the article as HTML
 * code, and it publishes it normally"). TipTap-based, with a source-HTML
 * view, an HTML import panel, and paste-to-upload images (click where you
 * want the image, Ctrl+V — it uploads, compresses and inserts automatically,
 * with alt defaulting to "{title} {n}"). Outputs into a hidden
 * <input name=...> so it submits with the surrounding <form>.
 */
export function RichTextEditor({
  name,
  defaultValue = "",
  placeholder = "Start writing…",
  minHeight = 320,
  altBase = "",
  onParagraphCountChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  minHeight?: number;
  /** Used to auto-name pasted images: "{altBase} {n}". Usually the article title. */
  altBase?: string;
  /** Fires on every edit with the current top-level paragraph count. */
  onParagraphCountChange?: (count: number) => void;
}) {
  const [html, setHtml] = useState(defaultValue);
  const [sourceMode, setSourceMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [uploading, setUploading] = useState(false);
  const imageCount = useRef(0);
  const altBaseRef = useRef(altBase);
  useEffect(() => {
    altBaseRef.current = altBase;
  }, [altBase]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      TiptapImage,
      Placeholder.configure({ placeholder }),
      ImagePromptNode,
    ],
    content: markersToPlaceholderHtml(defaultValue),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "article-prose max-w-none focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((i) => i.type.startsWith("image/"));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();

        imageCount.current += 1;
        const alt = `${altBaseRef.current || "Image"} ${imageCount.current}`.trim();
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alt", alt);
        uploadImageDirect(fd)
          .then((result) => {
            if (result.status === "success" && result.media) {
              const { schema } = view.state;
              const node = schema.nodes.image.create({
                src: result.media.url,
                alt: result.media.alt ?? alt,
              });
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
          })
          .finally(() => setUploading(false));
        return true;
      },
    },
    onCreate: ({ editor }) => reportStats(editor),
    onUpdate: ({ editor }) => {
      setHtml(editor.getHTML());
      reportStats(editor);
    },
  });

  function reportStats(ed: Editor) {
    let paragraphs = 0;
    ed.state.doc.forEach((node) => {
      if (node.type.name === "paragraph" && node.textContent.trim()) paragraphs++;
    });
    onParagraphCountChange?.(paragraphs);
  }

  if (!editor) {
    return (
      <div
        className="border-line bg-surface animate-pulse rounded-sm border"
        style={{ height: minHeight + 56 }}
      />
    );
  }

  function applyImport() {
    editor?.commands.setContent(markersToPlaceholderHtml(importText));
    setHtml(editor?.getHTML() ?? "");
    setImportText("");
    setImportOpen(false);
  }

  function applySource(next: string) {
    setHtml(next);
    editor?.commands.setContent(markersToPlaceholderHtml(next));
  }

  return (
    <div className="border-line rounded-sm border">
      <Toolbar
        editor={editor}
        sourceMode={sourceMode}
        onToggleSource={() => setSourceMode((v) => !v)}
        onToggleImport={() => setImportOpen((v) => !v)}
      />

      {importOpen && (
        <div className="border-line bg-surface border-b p-3">
          <p className="text-muted mb-2 text-xs font-semibold">
            Paste HTML to replace the content below with it.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder="<h2>…</h2><p>…</p>"
            className="border-line w-full rounded-sm border bg-white p-2 font-mono text-xs"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={applyImport}
              className="bg-ink rounded-sm px-3 py-1.5 text-xs font-bold text-white"
            >
              Insert HTML
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="text-muted text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sourceMode ? (
        <textarea
          value={html}
          onChange={(e) => applySource(e.target.value)}
          rows={16}
          className="w-full p-3 font-mono text-xs outline-none"
        />
      ) : (
        <div className="relative p-4">
          <EditorContent editor={editor} />
          {uploading && (
            <span className="bg-ink absolute top-2 right-2 rounded-sm px-2 py-1 text-[0.7rem] font-bold text-white">
              Uploading pasted image…
            </span>
          )}
          <p className="text-muted mt-2 text-[0.7rem]">
            Tip: click where you want an image and press Ctrl+V to paste one in — it uploads and compresses automatically.
          </p>
        </div>
      )}

      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-sm px-2 py-1 text-xs font-bold transition-colors ${
        active ? "bg-ink text-white" : "text-ink hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  sourceMode,
  onToggleSource,
  onToggleImport,
}: {
  editor: Editor;
  sourceMode: boolean;
  onToggleSource: () => void;
  onToggleImport: () => void;
}) {
  return (
    <div className="border-line bg-surface flex flex-wrap items-center gap-1 border-b p-2">
      <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        B
      </ToolbarButton>
      <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
        <span className="underline">U</span>
      </ToolbarButton>
      <span className="bg-line mx-1 h-5 w-px" />
      <ToolbarButton label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
        H2
      </ToolbarButton>
      <ToolbarButton label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
        H3
      </ToolbarButton>
      <span className="bg-line mx-1 h-5 w-px" />
      <ToolbarButton label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
        • List
      </ToolbarButton>
      <ToolbarButton label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
        1. List
      </ToolbarButton>
      <ToolbarButton label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
        ”
      </ToolbarButton>
      <span className="bg-line mx-1 h-5 w-px" />
      <ToolbarButton
        label="Link"
        onClick={() => {
          const url = window.prompt("Link URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }}
        active={editor.isActive("link")}
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        label="Image"
        onClick={() => {
          const url = window.prompt("Image URL");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
      >
        Img
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        HR
      </ToolbarButton>
      <span className="bg-line mx-1 h-5 w-px" />
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        ↺
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        ↻
      </ToolbarButton>
      <span className="ml-auto flex gap-1">
        <ToolbarButton label="Import HTML" onClick={onToggleImport}>
          Import HTML
        </ToolbarButton>
        <ToolbarButton label="Toggle HTML source" onClick={onToggleSource} active={sourceMode}>
          {sourceMode ? "Visual" : "HTML"}
        </ToolbarButton>
      </span>
    </div>
  );
}
