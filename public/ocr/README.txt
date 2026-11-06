Self-hosted OCR assets for tools 3.4 (scanned table) and 3.5 (invoice extractor).
- worker.min.js and tesseract-core-*lstm.wasm.js: tesseract.js 7.0.0 / tesseract.js-core 7.0.0 (Apache-2.0; see LICENSE-tesseract.js-core.txt). Only the LSTM builds are kept (OEM 1).
- *.traineddata: "fast" models from https://github.com/tesseract-ocr/tessdata_fast (Apache-2.0): eng, ara, fra, deu, spa.
Loaded from /ocr by src/tools/_shared/ocrEngine.ts. No third-party request at runtime.
