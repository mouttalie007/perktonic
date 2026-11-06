// Formulas for the parser tests (Part A section 4 edge cases).

/** 8 levels of nested functions. */
export const DEEP_8 = '=IFERROR(IF(AND(ISNUMBER(SEARCH("vip",LOWER(TRIM(INDEX(Customers!B:B,MATCH(A2,Customers!A:A,0)))))),C2>1000),"VIP","Standard"),"Unknown")';

/** Array constants, a structured reference with a special item, LET and LAMBDA. */
export const MODERN = "=LET(rates,{0.05,0.1;0.15,0.2},tax,LAMBDA(x,x*INDEX(rates,2,1)),tax(SUM(Orders[[#This Row],[Net]:[Shipping]])))";

/** Text that contains brackets, commas, semicolons and doubled quotes. */
export const TRICKY_TEXT = '=IF(A1="say ""hi"" (now), ok; really",CONCAT("(",B1,")"),"a,b")';

/** Broken formulas and where they fail (0-based position). */
export const BROKEN: { formula: string; pos: number; message: RegExp }[] = [
  { formula: "=SUM(A1:A10", pos: 4, message: /never closed/ },
  { formula: "=SUM(A1:A10))", pos: 12, message: /Extra "\)"/ },
  { formula: '=IF(A1="yes,1,0)', pos: 7, message: /never closed/ },
  { formula: "=IF(A1>,1,0)", pos: 7, message: /missing/ },
  { formula: "=SUM({1,2;3})", pos: 5, message: /same number of values/ },
];

/** A long formula near the 8,000 character limit with 25 levels of nesting. */
export function bigFormula(): string {
  const deep = "IF(A1>0,".repeat(25) + "1" + ",0)".repeat(25);
  const terms: string[] = [];
  while (terms.join("+").length < 7400) terms.push(`SUMIFS(Data!C:C,Data!A:A,"item ${terms.length}")`);
  return `=${deep}+${terms.join("+")}`;
}
