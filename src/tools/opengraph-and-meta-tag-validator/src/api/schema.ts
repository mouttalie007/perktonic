import { z } from "zod";
import { MAX_URL_LENGTH } from "../logic/url";

export const RequestSchema = z.object({
  url: z.string().trim().min(1, "Enter the URL of the page you want to share.").max(MAX_URL_LENGTH, `The URL can be at most ${MAX_URL_LENGTH} characters.`),
});
export type RequestBody = z.infer<typeof RequestSchema>;

const Image = z.object({
  url: z.string(),
  status: z.number().nullable(),
  size: z.number().nullable(),
  sizeAtLeast: z.boolean(),
  contentType: z.string().nullable(),
  type: z.enum(["jpeg", "png", "gif", "webp", "svg", "avif", "unknown"]),
  width: z.number().nullable(),
  height: z.number().nullable(),
  error: z.string().nullable(),
});

const PreviewImage = z.object({ dataUrl: z.string().nullable(), width: z.number().nullable(), height: z.number().nullable() });
const Preview = z.object({ title: z.string(), description: z.string().nullable(), domain: z.string(), image: PreviewImage.nullable(), layout: z.enum(["large", "small", "none"]) });

export const DataSchema = z.object({
  requestedUrl: z.string(),
  finalUrl: z.string(),
  status: z.number().int(),
  redirects: z.array(z.string()),
  truncated: z.boolean(),
  tags: z.object({
    titles: z.array(z.string()),
    description: z.string().nullable(),
    canonicals: z.array(z.string()),
    robots: z.string().nullable(),
    googlebot: z.string().nullable(),
    lang: z.string().nullable(),
    baseHref: z.string().nullable(),
    og: z.record(z.string(), z.array(z.string())),
    twitter: z.record(z.string(), z.string()),
    raw: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  image: Image.nullable(),
  twitterImage: Image.nullable(),
  issues: z.array(z.object({ severity: z.enum(["error", "warning", "info", "good"]), area: z.enum(["seo", "opengraph", "twitter", "image"]), message: z.string(), fix: z.string().nullable() })),
  previews: z.object({ facebook: Preview, x: Preview.extend({ card: z.string() }), linkedin: Preview, whatsapp: Preview }),
});
export type ResponseData = z.infer<typeof DataSchema>;

export const ResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: DataSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ApiResponse = z.infer<typeof ResponseSchema>;
