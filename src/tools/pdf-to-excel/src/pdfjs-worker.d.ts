// pdf.js ships its worker module without type declarations; we only import it for its side effect
// (it registers WorkerMessageHandler), so an untyped module is enough.
declare module "pdfjs-dist/build/pdf.worker.mjs";
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
