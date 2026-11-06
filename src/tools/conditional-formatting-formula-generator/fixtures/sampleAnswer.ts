// The model answer behind the saved AI example (also the golden answer of eval case "overdue-and-large").
export const sampleAnswer = {
  "status": "ok" as const,
  "kind": "conditional_formatting" as const,
  "formula": "=AND($E2=\"Overdue\",$D2>1000)",
  "appliesTo": "A2:G200",
  "formatSuggestion": "Light red fill (#FFC7CE) with dark red text (#9C0006)",
  "stepsExcel": [
    "Select A2:G200, starting from A2.",
    "Home > Conditional Formatting > New Rule.",
    "Choose “Use a formula to determine which cells to format” and paste the formula.",
    "Click Format…, choose the fill colour, then OK > OK."
  ],
  "stepsSheets": [
    "Select A2:G200.",
    "Format > Conditional formatting.",
    "Under “Format cells if…”, choose “Custom formula is” and paste the formula.",
    "Pick the formatting style, then Done."
  ],
  "notes": [
    "The $ before E and D keeps every cell of a row looking at columns E and D; the row number moves down row by row."
  ],
  "assumptions": [
    "Amounts in column D are numbers, not text.",
    "Status is spelled exactly Overdue (upper and lower case do not matter)."
  ]
};
