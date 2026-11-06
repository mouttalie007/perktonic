// Type declarations for packages that ship none under the path we import.

declare module "@mixmark-io/domino" {
  export function createDocument(html?: string, force?: boolean): Document;
}

declare module "turndown/lib/turndown.browser.es.js" {
  import TurndownService from "turndown";
  export default TurndownService;
}

declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  export const gfm: TurndownService.Plugin;
}
