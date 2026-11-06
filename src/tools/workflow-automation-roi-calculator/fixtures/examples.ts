import type { Currency } from "../src/logic/roi";
import type { RawInputs } from "../src/logic/share";

export interface Example {
  name: string;
  raw: RawInputs;
  currency: Currency;
}

/** Copying supplier invoices into the accounting system: the example the page opens with. */
export const INVOICE_ENTRY: Example = {
  name: "Invoice data entry",
  raw: { count: "20", per: "day", minutesPerTask: "4", people: "3", hourlyCost: "35", buildCost: "6000", monthlyCost: "150", automatedPercent: "90", workingDaysPerYear: "230" },
  currency: "USD",
};

/** A weekly report that takes little time: the tool cost is higher than the savings. */
export const WEEKLY_REPORT: Example = {
  name: "Weekly status report",
  raw: { count: "1", per: "week", minutesPerTask: "20", people: "1", hourlyCost: "40", buildCost: "1500", monthlyCost: "49", automatedPercent: "100", workingDaysPerYear: "230" },
  currency: "EUR",
};

/** Monthly payroll reconciliation in Morocco, priced in dirhams. */
export const PAYROLL_MAD: Example = {
  name: "Monthly payroll checks",
  raw: { count: "2", per: "month", minutesPerTask: "180", people: "2", hourlyCost: "120", buildCost: "15000", monthlyCost: "0", automatedPercent: "75", workingDaysPerYear: "230" },
  currency: "MAD",
};

export const EXAMPLES = [INVOICE_ENTRY, WEEKLY_REPORT, PAYROLL_MAD];
