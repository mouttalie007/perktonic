// The model answer behind the saved sample (also the golden answer of eval case "sumifs-per-region").
export const sampleAnswer = {
  "status": "ok" as const,
  "code": "SELECT region,\n       SUM(amount) AS total_amount\nFROM sales\nWHERE order_date >= DATE '2026-01-01'\nGROUP BY region\nORDER BY region;",
  "explanation": "The formula is filled down for each region, so in SQL it becomes one query that groups the sales by region and adds the amounts from 1 January 2026 onwards.",
  "mapping": [
    {
      "spreadsheet": "SUMIFS(Sales!$C:$C, …)",
      "target": "SUM(amount)",
      "note": "The column to add."
    },
    {
      "spreadsheet": "Sales!$A:$A,$A2 filled down",
      "target": "GROUP BY region",
      "note": "One row per region instead of one formula per row."
    },
    {
      "spreadsheet": "Sales!$B:$B,\">=\"&DATE(2026,1,1)",
      "target": "WHERE order_date >= DATE '2026-01-01'",
      "note": "The date condition applies to every group."
    }
  ],
  "assumptions": [
    "Regions that have no sales in 2026 do not appear; the spreadsheet would show 0 for them.",
    "Rows with an empty amount (NULL) are ignored by SUM, like blank cells in SUMIFS."
  ],
  "warnings": []
};
