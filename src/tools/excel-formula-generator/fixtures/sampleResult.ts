// The saved result the page opens with (nothing is sent). A test checks it equals buildResult(sampleAnswer).
import type { GeneratorResult } from "../src/types";

export const sampleResult: GeneratorResult = {
  "status": "ok",
  "platform": "excel365",
  "formula": "=SUMIFS(C2:C500,B2:B500,\"North\",A2:A500,\">=\"&DATE(2026,3,1),A2:A500,\"<\"&DATE(2026,4,1))",
  "explanation": "SUMIFS adds the sales in C2:C500 on rows where column B is North and the date in column A falls on or after 1 March 2026 and before 1 April 2026. Using a date range instead of the month number keeps other years out.",
  "alternative": {
    "formula": "=SUMPRODUCT((B2:B500=\"North\")*(TEXT(A2:A500,\"yyyy-mm\")=\"2026-03\")*C2:C500)",
    "whenToPrefer": "Prefer it when you later need a condition SUMIFS cannot express, such as comparing a calculated value per row."
  },
  "assumptions": [
    "Column A holds real dates, not text that looks like a date.",
    "\"North\" is spelled the same way in every row (SUMIFS ignores upper and lower case)."
  ],
  "checks": {
    "formula": {
      "warnings": [],
      "unknownFunctions": [],
      "newFunctions": [],
      "separator": "comma"
    },
    "alternative": {
      "warnings": [],
      "unknownFunctions": [],
      "newFunctions": [],
      "separator": "comma"
    }
  },
  "notes": [],
  "cached": false
}
;
