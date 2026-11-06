// The model answer behind the saved sample (also the golden answer of eval case "services-agreement-sample").
import type { Term } from "../src/types";

export const sampleAnswer: { status: "ok"; terms: Term[]; notes: string[] } = {
  "status": "ok",
  "terms": [
    {
      "category": "parties",
      "label": "Supplier",
      "value": "Northwind Analytics Ltd, registered in England",
      "normalised": null,
      "clauseRef": null,
      "quote": "This Services Agreement is made between Northwind Analytics Ltd, a company registered in England (the \"Supplier\"), and Harbor Foods Ltd (the \"Client\")."
    },
    {
      "category": "parties",
      "label": "Client",
      "value": "Harbor Foods Ltd",
      "normalised": null,
      "clauseRef": null,
      "quote": "This Services Agreement is made between Northwind Analytics Ltd, a company registered in England (the \"Supplier\"), and Harbor Foods Ltd (the \"Client\")."
    },
    {
      "category": "effective_date",
      "label": "Effective date",
      "value": "1 February 2026",
      "normalised": "2026-02-01",
      "clauseRef": "1.1",
      "quote": "1.1 This Agreement starts on 1 February 2026 (the \"Effective Date\") and continues for 12 months."
    },
    {
      "category": "term_or_expiry",
      "label": "Initial term",
      "value": "12 months from the Effective Date",
      "normalised": null,
      "clauseRef": "1.1",
      "quote": "1.1 This Agreement starts on 1 February 2026 (the \"Effective Date\") and continues for 12 months."
    },
    {
      "category": "obligation",
      "label": "Supplier obligation",
      "value": "Monthly sales dashboard and one analysis report each quarter",
      "normalised": null,
      "clauseRef": "2.1",
      "quote": "2.1 The Supplier shall deliver a monthly sales dashboard and one analysis report each quarter."
    },
    {
      "category": "obligation",
      "label": "Client obligation",
      "value": "Give read access to the sales database within 10 working days of the Effective Date",
      "normalised": null,
      "clauseRef": "2.2",
      "quote": "2.2 The Client shall give the Supplier read access to its sales database within 10 working days of the Effective Date."
    },
    {
      "category": "payment",
      "label": "Monthly fee",
      "value": "£4,500 per month plus VAT",
      "normalised": {
        "amount": 4500,
        "currency": "GBP"
      },
      "clauseRef": "3.1",
      "quote": "3.1 The Client shall pay a fee of £4,500 per month, plus VAT."
    },
    {
      "category": "payment",
      "label": "Payment terms",
      "value": "Invoices due within 30 days; late interest 4% above the Bank of England base rate",
      "normalised": null,
      "clauseRef": "3.2",
      "quote": "3.2 Invoices are payable within 30 days of the invoice date. Late payments carry interest at 4% above the Bank of England base rate."
    },
    {
      "category": "renewal",
      "label": "Automatic renewal",
      "value": "Renews for 12 months unless notice of non-renewal is given 60 days before the term ends",
      "normalised": null,
      "clauseRef": "4.1",
      "quote": "4.1 This Agreement renews automatically for further periods of 12 months unless either party gives notice of non-renewal at least 60 days before the end of the current term."
    },
    {
      "category": "termination",
      "label": "Termination for convenience",
      "value": "Either party, 90 days' written notice",
      "normalised": null,
      "clauseRef": "5.1",
      "quote": "5.1 Either party may terminate this Agreement with 90 days' written notice."
    },
    {
      "category": "termination",
      "label": "Termination for breach",
      "value": "Immediate, if a material breach is not remedied within 14 days of notice",
      "normalised": null,
      "clauseRef": "5.2",
      "quote": "5.2 Either party may terminate immediately if the other commits a material breach that is not remedied within 14 days of written notice."
    },
    {
      "category": "confidentiality",
      "label": "Confidentiality period",
      "value": "During the term and 3 years after it ends",
      "normalised": null,
      "clauseRef": "6.1",
      "quote": "6.1 Each party shall keep the other's confidential information secret during the term and for 3 years after it ends."
    },
    {
      "category": "liability",
      "label": "Liability cap",
      "value": "Supplier's liability limited to fees paid in the 12 months before the claim",
      "normalised": null,
      "clauseRef": "7.1",
      "quote": "7.1 The Supplier's total liability under this Agreement is limited to the fees paid in the 12 months before the claim."
    },
    {
      "category": "governing_law",
      "label": "Governing law",
      "value": "England and Wales",
      "normalised": null,
      "clauseRef": "8.1",
      "quote": "8.1 This Agreement is governed by the laws of England and Wales."
    }
  ],
  "notes": [
    "The agreement renews automatically unless notice is given at least 60 days before the end of the term."
  ]
};
