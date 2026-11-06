// The model answer behind the saved sample (also the golden answer of eval case "sample-product-sync").
import type { OkModelAnswer } from "../src/llm/schema";

export const sampleAnswer: OkModelAnswer = {
  "status": "ok",
  "title": "weekly product sync for the mobile app",
  "date": "2026-11-02",
  "attendees": [
    {
      "name": "Priya Shah",
      "role": null
    },
    {
      "name": "Marco Rossi",
      "role": null
    },
    {
      "name": "Lena Park",
      "role": null
    },
    {
      "name": "Sam Okafor",
      "role": null
    }
  ],
  "agenda": [
    {
      "topic": "Annual plan pricing",
      "summary": "The annual plan page is ready except for the copy; the team agreed on the launch date."
    },
    {
      "topic": "Crash reports",
      "summary": "Android crashes fell from 1.9% to 0.7% of sessions after release 4.2; login traces will be collected."
    },
    {
      "topic": "Open points",
      "summary": "The monthly discount after the launch is still undecided; the support domain must be renewed."
    }
  ],
  "decisions": [
    {
      "text": "Launch the annual plan on 16 November.",
      "quote": "Then we agree to launch the annual plan on 16 November."
    }
  ],
  "actionItems": [
    {
      "task": "Update the pricing page copy",
      "owner": "Lena Park",
      "dueDate": "2026-11-04",
      "dueText": "by Wednesday",
      "quote": "I'll update the pricing page copy by Wednesday."
    },
    {
      "task": "Collect the slowest login traces",
      "owner": "Sam Okafor",
      "dueDate": "2026-11-13",
      "dueText": "before next Friday",
      "quote": "Sam, can you collect the slowest login traces before next Friday?"
    },
    {
      "task": "Renew the support domain",
      "owner": null,
      "dueDate": "2026-11-30",
      "dueText": "before the end of the month",
      "quote": "Someone needs to renew the support domain before the end of the month."
    }
  ],
  "openQuestions": [
    {
      "text": "Do we keep the monthly discount after the annual plan launches? (to ask finance)",
      "quote": "do we keep the monthly discount after the annual plan launches?"
    }
  ]
};
