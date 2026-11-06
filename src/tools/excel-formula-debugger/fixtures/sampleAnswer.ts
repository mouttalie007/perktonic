// The model answer behind the saved AI diagnosis (also the golden answer of eval case "ref-column-index").
export const sampleAnswer = {
  "status": "ok" as const,
  "diagnosis": "The table range Products!A2:C200 has only 3 columns, but the formula asks for column 4, so VLOOKUP returns #REF!. The price is in column D, which is outside the range. The formula also has no fourth argument, so it would use approximate match on unsorted codes.",
  "correctedFormula": "=VLOOKUP(A2,Products!A2:D200,4,FALSE)",
  "assumptions": [
    "Prices are in column D of the Products sheet, rows 2 to 200.",
    "Each product code appears once in column A and you want an exact match."
  ],
  "preventionTips": [
    "Use XLOOKUP or INDEX/MATCH so inserting a column does not change which column is returned.",
    "Turn the product list into an Excel table so the range grows with new rows.",
    "Once the lookup works, IFNA(…,\"Unknown code\") can label codes that are genuinely missing."
  ]
};
