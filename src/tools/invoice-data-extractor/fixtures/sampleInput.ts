import type { PromptInput } from "../src/llm/prompt";

export const SAMPLE_FILE_NAME = "harbor-invoice-HOS-2026-118.pdf";

export const sampleInput: PromptInput = {
  "text": "Harbor Office Supply LLC\n1200 Pier Road, Portland, OR 97209\nEIN 93-1234567\nINVOICE\nInvoice number: HOS-2026-118\nInvoice date: October 28, 2026\nDue date: November 27, 2026\nBill to: Riverside Dental Clinic, 45 Elm Street, Portland, OR\n\nDescription                       Qty   Unit price     Amount\nNitrile gloves, box of 100         20         8.90     178.00\nPrinter paper A4, 5 reams           4        21.50      86.00\nHand sanitiser 1 L                  6         6.75      40.50\nWaiting room chair                  2       149.00     298.00\n\nSubtotal                                                602.50\nSales tax (8%)                                           48.20\nTotal due (USD)                                         650.70\n\nPay by bank transfer to account 4410 2938 1177 0045, routing 123000848.",
  "source": "pdf"
};
