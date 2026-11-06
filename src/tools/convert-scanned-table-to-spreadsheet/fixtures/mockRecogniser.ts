// The OCR mock used by the tests and the playground: returns fixed word boxes and reports progress.
import type { OcrWord, Recognise } from "../src/ocr/types";

export function mockRecogniser(words: OcrWord[] | ((lang: string) => OcrWord[])): Recognise & { calls: { lang: string; width: number }[] } {
  const calls: { lang: string; width: number }[] = [];
  const fn = (async (image, lang, onProgress) => {
    calls.push({ lang, width: image.width });
    onProgress(0.5);
    onProgress(1);
    return typeof words === "function" ? words(lang) : words;
  }) as Recognise & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}
