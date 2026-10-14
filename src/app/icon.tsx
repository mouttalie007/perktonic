import { brandIconResponse } from "@/lib/brand-icon";

// 192 = a multiple of 48px, which is what Google wants for search-result favicons.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return brandIconResponse(192);
}
