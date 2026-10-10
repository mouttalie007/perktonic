"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadImageDirect, updateMediaAltDirect } from "@/app/actions/admin-media";

export interface PastedImage {
  mediaId: string;
  url: string;
  alt: string;
}

/**
 * Paste-to-upload image field (per feedback — no manual "choose from
 * library" step). Click the box, press Ctrl+V; the clipboard image uploads
 * (compressed server-side) and becomes the value immediately. Alt defaults
 * to `${altBase} ${altNumber}` and stays editable.
 *
 * The box's click only focuses it for Ctrl+V — it deliberately does NOT
 * also open the native file picker (per feedback, 2026-10-10: the admin's
 * workflow is paste-only, and a click silently doing two different things
 * depending on what happens next was confusing). A file picker is still
 * available as a clearly separate "Or choose a file" button below, for the
 * rare case paste isn't an option.
 */
export function PasteImageField({
  name,
  urlFieldName,
  altBase,
  altNumber = 1,
  defaultValue,
  aspect = "aspect-video",
}: {
  name: string;
  /** Optional companion hidden field carrying the raw URL as a fallback —
   *  for models (like ListicleItem) that also accept a plain external URL
   *  rather than only a Media FK, so re-saving without touching the image
   *  doesn't drop a pre-existing non-uploaded URL. */
  urlFieldName?: string;
  altBase: string;
  altNumber?: number;
  defaultValue?: PastedImage | null;
  aspect?: string;
}) {
  const [image, setImage] = useState<PastedImage | null>(defaultValue ?? null);
  const [altText, setAltText] = useState(defaultValue?.alt ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setStatus("uploading");
    setError("");
    const alt = `${altBase || "Image"} ${altNumber}`.trim();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("alt", alt);
    const result = await uploadImageDirect(fd);
    if (result.status === "success" && result.media) {
      setImage({ mediaId: result.media.id, url: result.media.url, alt: result.media.alt ?? alt });
      setAltText(result.media.alt ?? alt);
      setStatus("idle");
    } else {
      setStatus("error");
      setError(result.message ?? "Upload failed.");
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) void upload(file);
  }

  return (
    <div>
      <div
        tabIndex={0}
        role="button"
        aria-label="Paste an image here with Ctrl+V"
        onPaste={handlePaste}
        className={`border-line hover:border-ink focus-visible:ring-accent-blue relative w-full cursor-pointer overflow-hidden rounded-sm border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none ${aspect}`}
      >
        {image ? (
          <Image src={image.url} alt={image.alt} fill sizes="400px" className="object-cover" />
        ) : (
          <div className="text-muted flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-xs">
            <span className="font-semibold">Click here, then press Ctrl+V</span>
            <span>to paste an image from your clipboard</span>
          </div>
        )}
        {status === "uploading" && (
          <div className="bg-canvas/80 absolute inset-0 flex items-center justify-center text-xs font-semibold">
            Uploading…
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-muted hover:text-ink mt-1 text-xs font-semibold underline"
      >
        Or choose a file
      </button>

      {error && <p className="text-accent-red mt-1 text-xs">{error}</p>}

      {image && (
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          onBlur={() => image && void updateMediaAltDirect(image.mediaId, altText)}
          placeholder="Alt text"
          aria-label="Image alt text"
          className="border-line mt-2 w-full rounded-sm border px-2 py-1 text-xs"
        />
      )}

      <input type="hidden" name={name} value={image?.mediaId ?? ""} />
      {urlFieldName && <input type="hidden" name={urlFieldName} value={image?.url ?? ""} />}
    </div>
  );
}
