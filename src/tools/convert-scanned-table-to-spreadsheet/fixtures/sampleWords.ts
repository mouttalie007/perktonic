// What the OCR engine returns for the sample image: word boxes in image pixels. "105" is misread as
// "1O5" with a low confidence, as real OCR often does, so the page shows an amber cell to check.
import type { OcrWord } from "../src/ocr/types";

export const sampleRules = {"h":[70,118,166,214,262,310,358],"v":[40,150,420,520,640,820]};

export const sampleWords: OcrWord[] = [
 {
  "text": "Stock",
  "confidence": 93,
  "bbox": {
   "x0": 40,
   "y0": 26,
   "x1": 101,
   "y1": 43
  }
 },
 {
  "text": "count",
  "confidence": 93,
  "bbox": {
   "x0": 106,
   "y0": 27,
   "x1": 167,
   "y1": 43
  }
 },
 {
  "text": "-",
  "confidence": 95,
  "bbox": {
   "x0": 172,
   "y0": 34,
   "x1": 179,
   "y1": 38
  }
 },
 {
  "text": "Warehouse",
  "confidence": 91,
  "bbox": {
   "x0": 185,
   "y0": 26,
   "x1": 303,
   "y1": 43
  }
 },
 {
  "text": "B",
  "confidence": 95,
  "bbox": {
   "x0": 310,
   "y0": 26,
   "x1": 324,
   "y1": 42
  }
 },
 {
  "text": "-",
  "confidence": 95,
  "bbox": {
   "x0": 331,
   "y0": 34,
   "x1": 338,
   "y1": 38
  }
 },
 {
  "text": "31",
  "confidence": 92,
  "bbox": {
   "x0": 345,
   "y0": 26,
   "x1": 369,
   "y1": 43
  }
 },
 {
  "text": "October",
  "confidence": 97,
  "bbox": {
   "x0": 375,
   "y0": 26,
   "x1": 460,
   "y1": 43
  }
 },
 {
  "text": "2026",
  "confidence": 96,
  "bbox": {
   "x0": 466,
   "y0": 26,
   "x1": 515,
   "y1": 43
  }
 },
 {
  "text": "SKU",
  "confidence": 89,
  "bbox": {
   "x0": 50,
   "y0": 87,
   "x1": 92,
   "y1": 102
  }
 },
 {
  "text": "Product",
  "confidence": 97,
  "bbox": {
   "x0": 161,
   "y0": 86,
   "x1": 236,
   "y1": 102
  }
 },
 {
  "text": "Shelf",
  "confidence": 93,
  "bbox": {
   "x0": 430,
   "y0": 86,
   "x1": 479,
   "y1": 102
  }
 },
 {
  "text": "Count",
  "confidence": 93,
  "bbox": {
   "x0": 530,
   "y0": 87,
   "x1": 588,
   "y1": 102
  }
 },
 {
  "text": "Unit",
  "confidence": 96,
  "bbox": {
   "x0": 651,
   "y0": 86,
   "x1": 689,
   "y1": 102
  }
 },
 {
  "text": "cost",
  "confidence": 96,
  "bbox": {
   "x0": 694,
   "y0": 87,
   "x1": 736,
   "y1": 102
  }
 },
 {
  "text": "00417",
  "confidence": 93,
  "bbox": {
   "x0": 50,
   "y0": 135,
   "x1": 105,
   "y1": 150
  }
 },
 {
  "text": "Nitrile",
  "confidence": 97,
  "bbox": {
   "x0": 161,
   "y0": 134,
   "x1": 211,
   "y1": 150
  }
 },
 {
  "text": "gloves",
  "confidence": 90,
  "bbox": {
   "x0": 217,
   "y0": 134,
   "x1": 274,
   "y1": 154
  }
 },
 {
  "text": "(box)",
  "confidence": 64,
  "bbox": {
   "x0": 281,
   "y0": 134,
   "x1": 325,
   "y1": 154
  }
 },
 {
  "text": "A-03",
  "confidence": 96,
  "bbox": {
   "x0": 430,
   "y0": 135,
   "x1": 472,
   "y1": 150
  }
 },
 {
  "text": "120",
  "confidence": 89,
  "bbox": {
   "x0": 531,
   "y0": 135,
   "x1": 563,
   "y1": 150
  }
 },
 {
  "text": "8.90",
  "confidence": 96,
  "bbox": {
   "x0": 650,
   "y0": 135,
   "x1": 689,
   "y1": 150
  }
 },
 {
  "text": "00982",
  "confidence": 93,
  "bbox": {
   "x0": 50,
   "y0": 183,
   "x1": 105,
   "y1": 198
  }
 },
 {
  "text": "Printer",
  "confidence": 97,
  "bbox": {
   "x0": 161,
   "y0": 182,
   "x1": 219,
   "y1": 198
  }
 },
 {
  "text": "paper",
  "confidence": 93,
  "bbox": {
   "x0": 225,
   "y0": 186,
   "x1": 276,
   "y1": 202
  }
 },
 {
  "text": "A4",
  "confidence": 92,
  "bbox": {
   "x0": 281,
   "y0": 183,
   "x1": 306,
   "y1": 197
  }
 },
 {
  "text": "B-11",
  "confidence": 96,
  "bbox": {
   "x0": 431,
   "y0": 183,
   "x1": 471,
   "y1": 197
  }
 },
 {
  "text": "64",
  "confidence": 92,
  "bbox": {
   "x0": 531,
   "y0": 183,
   "x1": 552,
   "y1": 198
  }
 },
 {
  "text": "21.50",
  "confidence": 93,
  "bbox": {
   "x0": 651,
   "y0": 183,
   "x1": 700,
   "y1": 198
  }
 },
 {
  "text": "01233",
  "confidence": 93,
  "bbox": {
   "x0": 50,
   "y0": 231,
   "x1": 105,
   "y1": 246
  }
 },
 {
  "text": "Hand",
  "confidence": 96,
  "bbox": {
   "x0": 161,
   "y0": 230,
   "x1": 207,
   "y1": 246
  }
 },
 {
  "text": "sanitiser",
  "confidence": 91,
  "bbox": {
   "x0": 213,
   "y0": 230,
   "x1": 288,
   "y1": 246
  }
 },
 {
  "text": "1",
  "confidence": 95,
  "bbox": {
   "x0": 294,
   "y0": 231,
   "x1": 304,
   "y1": 245
  }
 },
 {
  "text": "L",
  "confidence": 95,
  "bbox": {
   "x0": 311,
   "y0": 231,
   "x1": 321,
   "y1": 245
  }
 },
 {
  "text": "A-07",
  "confidence": 96,
  "bbox": {
   "x0": 430,
   "y0": 231,
   "x1": 472,
   "y1": 246
  }
 },
 {
  "text": "1O5",
  "confidence": 46,
  "bbox": {
   "x0": 531,
   "y0": 231,
   "x1": 568,
   "y1": 246
  }
 },
 {
  "text": "6.75",
  "confidence": 96,
  "bbox": {
   "x0": 651,
   "y0": 231,
   "x1": 689,
   "y1": 246
  }
 },
 {
  "text": "02310",
  "confidence": 93,
  "bbox": {
   "x0": 50,
   "y0": 279,
   "x1": 105,
   "y1": 294
  }
 },
 {
  "text": "Waiting",
  "confidence": 97,
  "bbox": {
   "x0": 160,
   "y0": 278,
   "x1": 225,
   "y1": 298
  }
 },
 {
  "text": "room",
  "confidence": 96,
  "bbox": {
   "x0": 233,
   "y0": 282,
   "x1": 276,
   "y1": 294
  }
 },
 {
  "text": "chair",
  "confidence": 93,
  "bbox": {
   "x0": 283,
   "y0": 278,
   "x1": 326,
   "y1": 294
  }
 },
 {
  "text": "C-01",
  "confidence": 96,
  "bbox": {
   "x0": 431,
   "y0": 279,
   "x1": 473,
   "y1": 294
  }
 },
 {
  "text": "12",
  "confidence": 92,
  "bbox": {
   "x0": 531,
   "y0": 279,
   "x1": 552,
   "y1": 293
  }
 },
 {
  "text": "149.00",
  "confidence": 90,
  "bbox": {
   "x0": 651,
   "y0": 279,
   "x1": 711,
   "y1": 294
  }
 },
 {
  "text": "02944",
  "confidence": 93,
  "bbox": {
   "x0": 50,
   "y0": 327,
   "x1": 105,
   "y1": 342
  }
 },
 {
  "text": "Paper",
  "confidence": 93,
  "bbox": {
   "x0": 161,
   "y0": 327,
   "x1": 214,
   "y1": 346
  }
 },
 {
  "text": "towels",
  "confidence": 90,
  "bbox": {
   "x0": 219,
   "y0": 326,
   "x1": 276,
   "y1": 342
  }
 },
 {
  "text": "(pack)",
  "confidence": 90,
  "bbox": {
   "x0": 282,
   "y0": 326,
   "x1": 336,
   "y1": 346
  }
 },
 {
  "text": "B-02",
  "confidence": 96,
  "bbox": {
   "x0": 431,
   "y0": 327,
   "x1": 472,
   "y1": 342
  }
 },
 {
  "text": "38",
  "confidence": 92,
  "bbox": {
   "x0": 530,
   "y0": 327,
   "x1": 552,
   "y1": 342
  }
 },
 {
  "text": "4.20",
  "confidence": 96,
  "bbox": {
   "x0": 650,
   "y0": 327,
   "x1": 689,
   "y1": 342
  }
 }
];
