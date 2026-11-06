// The OCR interface shared with tool 3.5. The real engine (tesseract.js) is wired by the Integrator
// behind this interface; tests and the playground use a mock that returns word boxes from fixtures.

/** Pixels in the shape of the browser's ImageData (RGBA, 4 bytes per pixel). */
export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface OcrWord {
  text: string;
  /** 0-100, as reported by the engine. */
  confidence: number;
  /** Pixel box in the image that was recognised. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export type Recognise = (image: ImageLike, lang: string, onProgress: (fraction: number) => void) => Promise<OcrWord[]>;
