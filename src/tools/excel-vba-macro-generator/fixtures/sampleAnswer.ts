// The model answer behind the saved sample (also the golden answer of eval case "explain-pdf-export").
export const sampleAnswer = {
  "status": "ok" as const,
  "summary": "The macro saves each worksheet of this workbook as its own PDF file in a folder called PDF next to the workbook. It creates the folder if needed, deletes any older PDF with the same name first, and shows a message with the number of sheets exported.",
  "lines": [
    {
      "from": 1,
      "to": 1,
      "text": "Forces every variable to be declared, so typing mistakes in names are caught before the macro runs."
    },
    {
      "from": 3,
      "to": 4,
      "text": "A comment describing the macro, then the start of the procedure ExportSheetsToPdf, which you run with Alt+F8."
    },
    {
      "from": 5,
      "to": 7,
      "text": "Declares three variables: the worksheet being processed, the output folder and the full path of each PDF."
    },
    {
      "from": 9,
      "to": 9,
      "text": "Builds the folder path: the workbook's own folder plus PDF, with the right separator for Windows or Mac."
    },
    {
      "from": 10,
      "to": 10,
      "text": "If that folder does not exist yet, MkDir creates it."
    },
    {
      "from": 12,
      "to": 13,
      "text": "Loops over every worksheet and builds the PDF path from the sheet name."
    },
    {
      "from": 14,
      "to": 15,
      "text": "If a PDF with that name already exists, Kill deletes it permanently so it can be replaced."
    },
    {
      "from": 16,
      "to": 16,
      "text": "Exports the sheet to the PDF file."
    },
    {
      "from": 17,
      "to": 17,
      "text": "Moves to the next worksheet."
    },
    {
      "from": 19,
      "to": 20,
      "text": "Shows how many sheets were exported and where, then ends the procedure."
    }
  ],
  "risks": [
    {
      "line": 15,
      "text": "Kill deletes existing PDF files with the same name without sending them to the Recycle Bin."
    },
    {
      "line": 10,
      "text": "Creates a new folder next to the workbook."
    }
  ]
};
