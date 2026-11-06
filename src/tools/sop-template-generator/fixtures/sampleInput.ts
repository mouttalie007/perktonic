import type { Brief } from "../src/types";

export const sampleInput: Brief = {
  "docType": "sop",
  "processName": "Customer refund requests",
  "industry": "E-commerce (home goods)",
  "teamSize": "8",
  "steps": "Check the order number and purchase date in the order system\nConfirm the item is within the 30-day return window\nApprove or decline the refund\nSend the customer a confirmation email",
  "owner": "Maria Lopez"
};

/** The date of the saved example (the page must not read the clock while rendering). */
export const sampleDate = "2026-11-02";
