import type { Lang, Platform } from "../src/logic/settings";

export interface Example {
  label: string;
  formula: string;
  from: Platform;
  to: Platform;
  fromLang: Lang;
  toLang: Lang;
}

/** "Try an example" cycles through these; the first is loaded when the page opens. */
export const EXAMPLES: Example[] = [
  {
    label: "French Excel lookup → Google Sheets",
    formula: `=SI(NB.SI(Clients!$A$2:$A$500;A2)>0;RECHERCHEV(A2;Clients!$A$2:$D$500;4;FAUX);"Inconnu")`,
    from: "excel",
    to: "sheets",
    fromLang: "fr",
    toLang: "en",
  },
  {
    label: "Google Sheets → Excel (JOIN, REGEXMATCH, open ranges)",
    formula: `=IFERROR(JOIN(", ", UNIQUE(FILTER(B2:B, REGEXMATCH(C2:C, "^EU-")))), "none")`,
    from: "sheets",
    to: "excel",
    fromLang: "en",
    toLang: "en",
  },
  {
    label: "Excel array formula → LibreOffice",
    formula: `{=SUM(IF('Q3 Sales'!B2:B50>100,1,0))}`,
    from: "excel",
    to: "calc",
    fromLang: "en",
    toLang: "en",
  },
  {
    label: "LibreOffice → German Excel",
    formula: `=DAYSINMONTH(A2)+MONTHS($Data.B2;$Data.C2;0)`,
    from: "calc",
    to: "excel",
    fromLang: "en",
    toLang: "de",
  },
  {
    label: "Excel → Google Sheets with an unsupported function",
    formula: `=TEXTBEFORE(A2,"@")&" ("&AGGREGATE(9,6,D2:D100)&")"`,
    from: "excel",
    to: "sheets",
    fromLang: "en",
    toLang: "en",
  },
];
