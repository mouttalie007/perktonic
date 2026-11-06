// The model answer behind the saved sample (also the golden answer of eval case "sample-us-invoice").
import type { OkModelAnswer } from "../src/llm/schema";

export const sampleAnswer: OkModelAnswer = {
  "status": "ok",
  "vendor": {
    "value": "Harbor Office Supply LLC",
    "quote": "Harbor Office Supply LLC"
  },
  "vendorTaxId": {
    "value": "93-1234567",
    "quote": "EIN 93-1234567"
  },
  "invoiceNumber": {
    "value": "HOS-2026-118",
    "quote": "Invoice number: HOS-2026-118"
  },
  "invoiceDate": {
    "value": "2026-10-28",
    "quote": "Invoice date: October 28, 2026"
  },
  "dueDate": {
    "value": "2026-11-27",
    "quote": "Due date: November 27, 2026"
  },
  "currency": {
    "value": "USD",
    "quote": "Total due (USD)                                         650.70"
  },
  "lineItems": [
    {
      "description": "Nitrile gloves, box of 100",
      "quantity": "20",
      "unitPrice": "8.90",
      "amount": "178.00",
      "quote": "Nitrile gloves, box of 100         20         8.90     178.00"
    },
    {
      "description": "Printer paper A4, 5 reams",
      "quantity": "4",
      "unitPrice": "21.50",
      "amount": "86.00",
      "quote": "Printer paper A4, 5 reams           4        21.50      86.00"
    },
    {
      "description": "Hand sanitiser 1 L",
      "quantity": "6",
      "unitPrice": "6.75",
      "amount": "40.50",
      "quote": "Hand sanitiser 1 L                  6         6.75      40.50"
    },
    {
      "description": "Waiting room chair",
      "quantity": "2",
      "unitPrice": "149.00",
      "amount": "298.00",
      "quote": "Waiting room chair                  2       149.00     298.00"
    }
  ],
  "subtotal": {
    "value": "602.50",
    "quote": "Subtotal                                                602.50"
  },
  "taxes": [
    {
      "name": "Sales tax",
      "rate": "8%",
      "amount": "48.20",
      "quote": "Sales tax (8%)                                           48.20"
    }
  ],
  "total": {
    "value": "650.70",
    "quote": "Total due (USD)                                         650.70"
  },
  "notes": []
};
