/** "Try an example" cycles through these; each shows a different conversion problem. */
export const EXAMPLES: { label: string; formula: string }[] = [
  { label: "VLOOKUP with IFERROR", formula: '=IFERROR(VLOOKUP(A2, Products!$A$2:$D$500, 3, FALSE), "Not found")' },
  { label: "Left lookup with XLOOKUP", formula: "=XLOOKUP(F2, $C$2:$C$200, $A$2:$A$200)" },
  { label: "Approximate tax band", formula: "=VLOOKUP(B5, $H$2:$I$8, 2)" },
  { label: "HLOOKUP across months", formula: "=HLOOKUP(\"Mar\", $B$1:$M$4, 3, FALSE)" },
];
