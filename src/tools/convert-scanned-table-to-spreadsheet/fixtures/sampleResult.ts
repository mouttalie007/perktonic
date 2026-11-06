// The sample page as the tool shows it on load: the sample image, its OCR words and the grid built
// from them by our own reconstruction (no OCR runs when the page opens).
import { reconstruct } from "../src/logic/table";
import { SAMPLE_IMAGE_HEIGHT, SAMPLE_IMAGE_URL, SAMPLE_IMAGE_WIDTH } from "./sampleImage";
import { sampleRules, sampleWords } from "./sampleWords";
import type { PageResult } from "../src/logic/page";

export const samplePage: PageResult = {
  page: 1,
  imageUrl: SAMPLE_IMAGE_URL,
  width: SAMPLE_IMAGE_WIDTH,
  height: SAMPLE_IMAGE_HEIGHT,
  skew: 0,
  words: sampleWords,
  grid: reconstruct(sampleWords, { rtl: false, rules: sampleRules }),
};
