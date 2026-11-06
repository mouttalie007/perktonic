// The analysis of the sample PDF, saved so the page shows it without any work on load. A test checks it is current.
import type { Analysis } from "../src/logic/pdfTables";

export const sampleAnalysis: Analysis = {
  "tables": [
    {
      "pages": [
        1
      ],
      "method": "ruled",
      "rows": [
        [
          "SKU",
          "Description",
          "Qty",
          "Unit price",
          "Amount"
        ],
        [
          "00417",
          "Nitrile gloves, box of 100",
          "20",
          "8.90",
          "178.00"
        ],
        [
          "00982",
          "Printer paper A4, 5 reams",
          "4",
          "21.50",
          "86.00"
        ],
        [
          "01233",
          "Hand sanitiser 1 L",
          "6",
          "6.75",
          "40.50"
        ],
        [
          "02310",
          "Waiting room chair",
          "2",
          "149.00",
          "298.00"
        ]
      ],
      "merges": [],
      "headerRows": 1,
      "rtl": false,
      "edges": [
        50,
        110,
        300,
        370,
        450,
        545
      ],
      "top": 110,
      "bottom": 210,
      "droppedHeaders": 0
    },
    {
      "pages": [
        1
      ],
      "method": "aligned",
      "rows": [
        [
          "Subtotal",
          "602.50",
          "USD"
        ],
        [
          "Sales tax 8%",
          "48.20",
          "USD"
        ],
        [
          "Total due",
          "650.70",
          "USD"
        ]
      ],
      "merges": [],
      "headerRows": 0,
      "rtl": false,
      "edges": [
        50,
        163.89,
        290,
        351.11
      ],
      "top": 265,
      "bottom": 307,
      "droppedHeaders": 0
    }
  ],
  "pagesRead": [
    1
  ],
  "textless": false
};

export const SAMPLE_NUM_PAGES = 1;
