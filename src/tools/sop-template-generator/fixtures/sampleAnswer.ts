// The model answer behind the saved sample (also the golden answer of eval case "refund-sop-sample").
import type { Answer } from "../src/logic/result";

export const sampleAnswer: Answer = {
  "status": "ok",
  "purpose": "This procedure explains how the customer service team handles refund requests for home goods orders, so that every customer gets the same fair and quick decision. It protects customer trust and keeps refunds traceable for the finance team.",
  "scope": "Applies to the 8 people of the customer service team who receive refund requests by email, chat or phone. It starts when a customer asks for a refund and ends when the customer has received a confirmation email. Exchanges, damaged-in-transit claims handled by the carrier and wholesale orders are out of scope.",
  "roles": [
    {
      "role": "Process owner",
      "responsibility": "Maria Lopez keeps this procedure up to date, approves exceptions and reviews the refund log each month."
    },
    {
      "role": "Customer service agent",
      "responsibility": "Receives the request, checks the order, records the decision and writes to the customer."
    },
    {
      "role": "Team lead",
      "responsibility": "Decides on refunds outside the return window or above the agent's approval limit."
    },
    {
      "role": "Finance",
      "responsibility": "Issues the payment back to the customer and reconciles refunds with the order system."
    }
  ],
  "steps": [
    {
      "n": 1,
      "action": "Log the refund request in the support inbox with the customer's name and contact details.",
      "owner": "Customer service agent"
    },
    {
      "n": 2,
      "action": "Check the order number and purchase date in the order system",
      "owner": "Customer service agent"
    },
    {
      "n": 3,
      "action": "Confirm the item is within the 30-day return window",
      "owner": "Customer service agent"
    },
    {
      "n": 4,
      "action": "Ask the customer for photos or a return tracking number when the item condition must be checked.",
      "owner": "Customer service agent"
    },
    {
      "n": 5,
      "action": "Approve or decline the refund",
      "owner": "Customer service agent (team lead for exceptions)"
    },
    {
      "n": 6,
      "action": "Pass approved refunds to finance with the order number and amount.",
      "owner": "Customer service agent"
    },
    {
      "n": 7,
      "action": "Send the customer a confirmation email",
      "owner": "Customer service agent"
    },
    {
      "n": 8,
      "action": "Close the ticket and note the reason for the refund.",
      "owner": "Customer service agent"
    }
  ],
  "kpis": [
    {
      "name": "Time to decision",
      "howMeasured": "Hours between the request and the approve/decline decision, from the ticket timestamps; target [to be completed]."
    },
    {
      "name": "Refund rate",
      "howMeasured": "Refunds approved divided by orders shipped in the same month; target [to be completed]."
    },
    {
      "name": "Customer satisfaction after refund",
      "howMeasured": "Score from the survey sent with the confirmation email; target [to be completed]."
    }
  ],
  "notes": [
    "Set the agent's approval limit and add it to the team lead role.",
    "Check that the confirmation email template states when the money will arrive."
  ]
};
