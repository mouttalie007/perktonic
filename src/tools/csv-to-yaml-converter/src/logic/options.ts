// No imports: shared by the page and the worker.

export type Format = "csv" | "yaml" | "xml" | "toml";

export const DIRECTIONS: { from: Format; to: Format; label: string }[] = [
  { from: "csv", to: "yaml", label: "CSV → YAML" },
  { from: "csv", to: "xml", label: "CSV → XML" },
  { from: "csv", to: "toml", label: "CSV → TOML" },
  { from: "yaml", to: "csv", label: "YAML → CSV" },
  { from: "xml", to: "csv", label: "XML → CSV" },
  { from: "toml", to: "csv", label: "TOML → CSV" },
];

export interface ConvertOptions {
  from: Format;
  to: Format;
  detectTypes: boolean;
  nest: boolean;
  listSeparator: string;
  yamlRoot: string;
  tomlKey: string;
  xmlRoot: string;
  xmlRow: string;
  xmlAttributes: boolean;
  delimiter: "," | ";" | "\t";
  bom: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  from: "csv",
  to: "yaml",
  detectTypes: true,
  nest: true,
  listSeparator: "|",
  yamlRoot: "servers",
  tomlKey: "servers",
  xmlRoot: "servers",
  xmlRow: "server",
  xmlAttributes: false,
  delimiter: ",",
  bom: false,
};

export const EXT: Record<Format, string> = { csv: "csv", yaml: "yaml", xml: "xml", toml: "toml" };
export const MIME: Record<Format, string> = { csv: "text/csv", yaml: "application/yaml", xml: "application/xml", toml: "application/toml" };
export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_DISPLAY_CHARS = 200_000;
