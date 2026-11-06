import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  formula: '=LET(sales,FILTER(Sales[Amount],(Sales[Region]="North")*(MONTH(Sales[Date])=3),0),IF(SUM(sales)=0,"No sales",ROUND(AVERAGE(sales),2)))',
  sampleValues: "Sales is an Excel table with Date (real dates), Region (North, South, East) and Amount (numbers).",
};
