// The model answer behind the saved narration (also the golden answer of eval case "let-filter-sample").
export const sampleAnswer = {
  status: "ok" as const,
  summary:
    "Averages the Amount values of the Sales table for rows in the North region dated in March (of any year), rounded to two decimals. If no row matches, or the matching amounts add up to zero, it shows the text No sales instead.",
  steps: [
    { part: '(Sales[Region]="North")', text: "Checks every row of the Region column and gives TRUE for North rows and FALSE for the others." },
    { part: "(MONTH(Sales[Date])=3)", text: "MONTH takes the month number of each date; comparing it with 3 gives TRUE for rows dated in March, in any year." },
    { part: '(Sales[Region]="North")*(MONTH(Sales[Date])=3)', text: "Multiplying the two TRUE/FALSE lists gives 1 only where both are true, so it works as AND: North and March." },
    { part: 'FILTER(Sales[Amount],(Sales[Region]="North")*(MONTH(Sales[Date])=3),0)', text: "Keeps the amounts of those rows as a list; when no row matches it returns 0 instead of an error." },
    { part: "LET(sales,", text: "Stores that list under the name sales, so it is worked out once and reused twice below." },
    { part: 'IF(SUM(sales)=0,"No sales"', text: "If the kept amounts add up to zero, the result is the text No sales." },
    { part: "ROUND(AVERAGE(sales),2)", text: "Otherwise it averages the kept amounts and rounds the average to 2 decimal places, which is the number the cell shows." },
  ],
};
